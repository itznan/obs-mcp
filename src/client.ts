import WebSocket from 'ws';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { validateSafety } from './safety.js';

const logger = {
  log: (message: string) => console.error(message),
  error: (message: string) => console.error(message),
  debug: (message: string) => console.error(message),
};

// Define OpCodes
enum OpCode {
  Hello = 0,
  Identify = 1,
  Identified = 2,
  Reidentify = 3,
  Event = 5,
  Request = 6,
  RequestResponse = 7,
  RequestBatch = 8,
  RequestBatchResponse = 9
}

// Define EventSubscription bitmasks
export enum EventSubscription {
  None = 0,
  General = 1 << 0,
  Config = 1 << 1,
  Scenes = 1 << 2,
  Inputs = 1 << 3,
  Transitions = 1 << 4,
  Filters = 1 << 5,
  Outputs = 1 << 6,
  SceneItems = 1 << 7,
  MediaInputs = 1 << 8,
  Vendors = 1 << 9,
  Ui = 1 << 10,
  All = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) | (1 << 10)
}

// Event Ring Buffer definitions
export interface OBSEventRecord {
  id: string;
  timestamp: string;
  millis: number;
  eventType: string;
  eventIntent?: number;
  eventData?: any;
}

export class EventRingBuffer {
  private buffer: (OBSEventRecord | undefined)[];
  private capacity: number;
  private head: number = 0;
  private count: number = 0;

  constructor(capacity: number = 100) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  public push(event: { eventType: string; eventIntent?: number; eventData?: any; id?: string; timestamp?: string; millis?: number }): OBSEventRecord {
    const record: OBSEventRecord = {
      id: event.id || crypto.randomUUID(),
      timestamp: event.timestamp || new Date().toISOString(),
      millis: event.millis ?? Date.now(),
      eventType: event.eventType,
      eventIntent: event.eventIntent,
      eventData: event.eventData ?? {}
    };

    const index = (this.head + this.count) % this.capacity;
    if (this.count < this.capacity) {
      this.buffer[index] = record;
      this.count++;
    } else {
      this.buffer[this.head] = record;
      this.head = (this.head + 1) % this.capacity;
    }
    return record;
  }

  public toArray(): OBSEventRecord[] {
    const result: OBSEventRecord[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head + i) % this.capacity;
      const item = this.buffer[idx];
      if (item) {
        result.push(item);
      }
    }
    return result;
  }

  public getRecent(limit?: number, filterType?: string): OBSEventRecord[] {
    let events = this.toArray();
    if (filterType && filterType.trim()) {
      const query = filterType.trim().toLowerCase();
      events = events.filter(e => e.eventType.toLowerCase().includes(query));
    }
    if (limit && limit > 0 && limit < events.length) {
      events = events.slice(events.length - limit);
    }
    return events;
  }

  public clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.count = 0;
  }

  public size(): number {
    return this.count;
  }

  public getCapacity(): number {
    return this.capacity;
  }
}

// Batch Request Interfaces
export interface RequestBatchItem {
  requestType: string;
  requestId?: string;
  requestData?: any;
}

export type RequestBatchExecutionType = 0 | 1 | 2; // 0 = SerialRealtime, 1 = SerialFrame, 2 = Parallel

export interface RequestBatchOptions {
  haltOnFailure?: boolean;
  executionType?: RequestBatchExecutionType | 'SerialRealtime' | 'SerialFrame' | 'Parallel';
  timeout?: number;
  confirm?: boolean;
}

export interface RequestBatchResponseItem {
  requestType: string;
  requestId: string;
  requestStatus: {
    result: boolean;
    code: number;
    comment?: string;
  };
  responseData?: any;
}

export interface RequestBatchResponseData {
  requestId: string;
  results: RequestBatchResponseItem[];
}

// Define interfaces for message types
interface BaseMessage {
  op: OpCode;
  d: any;
}

interface HelloMessage extends BaseMessage {
  d: {
    obsStudioVersion: string;
    obsWebSocketVersion: string;
    rpcVersion: number;
    authentication?: {
      challenge: string;
      salt: string;
    };
  };
}

interface IdentifyMessage extends BaseMessage {
  d: {
    rpcVersion: number;
    authentication?: string;
    eventSubscriptions: number;
  };
}

interface IdentifiedMessage extends BaseMessage {
  d: {
    negotiatedRpcVersion: number;
  };
}

interface RequestMessage extends BaseMessage {
  d: {
    requestType: string;
    requestId: string;
    requestData?: any;
  };
}

interface RequestResponseMessage extends BaseMessage {
  d: {
    requestType: string;
    requestId: string;
    requestStatus: {
      result: boolean;
      code: number;
      comment?: string;
    };
    responseData?: any;
  };
}

interface RequestBatchMessage extends BaseMessage {
  d: {
    requestId: string;
    haltOnFailure?: boolean;
    executionType?: number;
    requests: Array<{
      requestType: string;
      requestId?: string;
      requestData?: any;
    }>;
  };
}

interface RequestBatchResponseMessage extends BaseMessage {
  d: {
    requestId: string;
    results: RequestBatchResponseItem[];
  };
}

interface EventMessage extends BaseMessage {
  d: {
    eventType: string;
    eventIntent: number;
    eventData?: any;
  };
}

// Define the OBS WebSocket client class
export class OBSWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private password: string | null;
  private connected: boolean = false;
  private identified: boolean = false;
  private pendingRequests: Map<string, { resolve: Function, reject: Function, timeout: NodeJS.Timeout }> = new Map();
  private eventBuffer: EventRingBuffer = new EventRingBuffer(100);

  constructor(url: string = 'ws://localhost:4455', password: string | null = null) {
    super();
    this.url = url;
    this.password = password;
  }

  /**
   * Connect to the OBS WebSocket server
   */
  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      try {
        logger.log(`Attempting to connect to OBS WebSocket at: ${this.url}`);
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this.connected = true;
          logger.log('WebSocket connection opened successfully');
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as BaseMessage;
            this.handleMessage(message);
          } catch (error) {
            logger.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.connected = false;
          this.identified = false;
          const reasonStr = reason.toString() || 'No reason provided';
          logger.log(`WebSocket connection closed with code ${code}: ${reasonStr}`);
          this.emit('disconnected');

          // Clear all pending requests
          this.pendingRequests.forEach((request) => {
            clearTimeout(request.timeout);
            request.reject(new Error(`WebSocket connection closed: ${reasonStr}`));
          });
          this.pendingRequests.clear();
        });

        this.ws.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`WebSocket connection error: ${errorMessage}`);
          
          // Provide more specific error information
          if (errorMessage.includes('ECONNREFUSED')) {
            logger.error('Connection refused. Make sure OBS Studio is running and WebSocket is enabled.');
            logger.error('Check that the WebSocket port (default: 4455) is not blocked by firewall.');
          } else if (errorMessage.includes('ENOTFOUND')) {
            logger.error('Host not found. Check the OBS_WEBSOCKET_URL environment variable.');
          } else if (errorMessage.includes('ETIMEDOUT')) {
            logger.error('Connection timed out. Check network connectivity and firewall settings.');
          }
          
          reject(error);
        });

        // Set up the identification process
        this.once('hello', async (hello: HelloMessage['d']) => {
          try {
            await this.identify(hello);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        // Set a timeout for the initial connection
        const connectionTimeout = setTimeout(() => {
          if (!this.connected) {
            this.ws?.terminate();
            reject(new Error('WebSocket connection timeout - OBS may not be running or WebSocket may be disabled'));
          }
        }, 5000);

        this.ws.on('open', () => {
          clearTimeout(connectionTimeout);
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to create WebSocket connection: ${errorMessage}`);
        reject(error);
      }
    });
  }

  /**
   * Check if the client is connected and identified
   */
  public isConnected(): boolean {
    return this.connected && this.identified;
  }

  /**
   * Get connection status information
   */
  public getConnectionStatus(): {
    connected: boolean;
    identified: boolean;
    url: string;
    hasPassword: boolean;
  } {
    return {
      connected: this.connected,
      identified: this.identified,
      url: this.url,
      hasPassword: this.password !== null
    };
  }

  /**
   * Disconnect from the OBS WebSocket server
   */
  public disconnect(): void {
    if (this.ws && this.connected) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.identified = false;
    }
  }

  /**
   * Send a request to the OBS WebSocket server
   */
  public async sendRequest<T = any>(
    requestType: string,
    requestData?: any,
    timeout: number = 10000,
    options?: { confirm?: boolean }
  ): Promise<T> {
    // Extract confirm flag if provided in options or in requestData
    let isConfirmed = options?.confirm ?? false;
    let cleanRequestData = requestData;

    if (requestData && typeof requestData === 'object' && 'confirm' in requestData) {
      if (requestData.confirm === true) {
        isConfirmed = true;
      }
      const { confirm, ...rest } = requestData;
      cleanRequestData = Object.keys(rest).length > 0 ? rest : undefined;
    }

    // Enforce safety guardrails before network transmission
    validateSafety(requestType, isConfirmed);

    if (!this.ws || !this.connected || !this.identified) {
      throw new Error('Not connected or identified with OBS WebSocket server');
    }

    return new Promise<T>((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestType} timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: (data: T) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeout: timeoutId
      });

      const requestMessage: RequestMessage = {
        op: OpCode.Request,
        d: {
          requestType,
          requestId,
          requestData: cleanRequestData
        }
      };

      this.ws!.send(JSON.stringify(requestMessage));
    });
  }

  /**
   * Send a batch of requests to the OBS WebSocket server (OpCode 8 RequestBatch)
   */
  public async sendRequestBatch(
    requests: RequestBatchItem[],
    options?: RequestBatchOptions
  ): Promise<RequestBatchResponseData> {
    if (!Array.isArray(requests) || requests.length === 0) {
      throw new Error('sendRequestBatch requires a non-empty array of requests');
    }

    const timeout = options?.timeout ?? 15000;
    const batchConfirm = options?.confirm ?? false;

    // Validate safety for every individual request in the batch prior to sending
    const sanitizedRequests = requests.map((req, idx) => {
      let isConfirmed = batchConfirm;
      let cleanRequestData = req.requestData;

      if (cleanRequestData && typeof cleanRequestData === 'object' && 'confirm' in cleanRequestData) {
        if (cleanRequestData.confirm === true) {
          isConfirmed = true;
        }
        const { confirm, ...rest } = cleanRequestData;
        cleanRequestData = Object.keys(rest).length > 0 ? rest : undefined;
      }

      validateSafety(req.requestType, isConfirmed);

      return {
        requestType: req.requestType,
        requestId: req.requestId || `batch_req_${idx}_${crypto.randomUUID()}`,
        requestData: cleanRequestData
      };
    });

    if (!this.ws || !this.connected || !this.identified) {
      throw new Error('Not connected or identified with OBS WebSocket server');
    }

    // Map executionType enum/string
    let executionTypeNum = 0;
    if (typeof options?.executionType === 'number') {
      executionTypeNum = options.executionType;
    } else if (typeof options?.executionType === 'string') {
      const lower = options.executionType.toLowerCase();
      if (lower === 'serialframe') {
        executionTypeNum = 1;
      } else if (lower === 'parallel') {
        executionTypeNum = 2;
      } else {
        executionTypeNum = 0; // default SerialRealtime
      }
    }

    return new Promise<RequestBatchResponseData>((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Batch request ${requestId} timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(requestId, {
        resolve: (data: any) => {
          clearTimeout(timeoutId);
          resolve(data);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeout: timeoutId
      });

      const batchMessage: RequestBatchMessage = {
        op: OpCode.RequestBatch,
        d: {
          requestId,
          haltOnFailure: options?.haltOnFailure ?? false,
          executionType: executionTypeNum,
          requests: sanitizedRequests
        }
      };

      this.ws!.send(JSON.stringify(batchMessage));
    });
  }

  /**
   * Get recent OBS events captured in the ring buffer
   */
  public getRecentEvents(limit?: number, filterType?: string): OBSEventRecord[] {
    return this.eventBuffer.getRecent(limit, filterType);
  }

  /**
   * Access the underlying event ring buffer
   */
  public getEventBuffer(): EventRingBuffer {
    return this.eventBuffer;
  }

  /**
   * Clear the event ring buffer
   */
  public clearRecentEvents(): void {
    this.eventBuffer.clear();
  }

  /**
   * Handle incoming messages from the OBS WebSocket server
   */
  private handleMessage(message: BaseMessage): void {
    switch (message.op) {
      case OpCode.Hello:
        this.emit('hello', (message as HelloMessage).d);
        break;

      case OpCode.Identified:
        this.identified = true;
        this.emit('identified', (message as IdentifiedMessage).d);
        break;

      case OpCode.RequestResponse:
        this.handleRequestResponse(message as RequestResponseMessage);
        break;

      case OpCode.RequestBatchResponse:
        this.handleRequestBatchResponse(message as RequestBatchResponseMessage);
        break;

      case OpCode.Event:
        this.handleEvent(message as EventMessage);
        break;

      default:
        logger.debug(`Unhandled message type: ${message.op}`);
        break;
    }
  }

  /**
   * Handle request responses from the OBS WebSocket server
   */
  private handleRequestResponse(message: RequestResponseMessage): void {
    const { requestId, requestStatus, responseData } = message.d;
    const pendingRequest = this.pendingRequests.get(requestId);

    if (pendingRequest) {
      this.pendingRequests.delete(requestId);

      if (requestStatus.result) {
        pendingRequest.resolve(responseData || {});
      } else {
        const errorMessage = `Request failed: ${requestStatus.code} ${requestStatus.comment || ''}`;
        pendingRequest.reject(new Error(errorMessage));
      }
    }
  }

  /**
   * Handle batch responses from the OBS WebSocket server
   */
  private handleRequestBatchResponse(message: RequestBatchResponseMessage): void {
    const { requestId, results } = message.d;
    const pendingRequest = this.pendingRequests.get(requestId);

    if (pendingRequest) {
      this.pendingRequests.delete(requestId);
      pendingRequest.resolve({
        requestId,
        results: results || []
      });
    }
  }

  /**
   * Handle events from the OBS WebSocket server and store in circular ring buffer
   */
  private handleEvent(message: EventMessage): void {
    const { eventType, eventData, eventIntent } = message.d;
    this.eventBuffer.push({
      eventType,
      eventIntent,
      eventData
    });
    this.emit('event', eventType, eventData);
    this.emit(eventType, eventData);
  }

  /**
   * Identify with the OBS WebSocket server
   */
  private async identify(hello: HelloMessage['d']): Promise<void> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to OBS WebSocket server');
    }

    logger.log(`Received hello from OBS WebSocket v${hello.obsWebSocketVersion} (OBS v${hello.obsStudioVersion})`);
    logger.log(`RPC Version: ${hello.rpcVersion}`);

    let authentication: string | undefined;

    // Handle authentication if required
    if (hello.authentication && this.password) {
      logger.log('Authentication required, generating auth string...');
      authentication = this.generateAuthenticationString(
        this.password,
        hello.authentication.salt,
        hello.authentication.challenge
      );
    } else if (hello.authentication && !this.password) {
      const errorMsg = 'Password required for authentication but not provided. Set OBS_WEBSOCKET_PASSWORD environment variable.';
      logger.error(errorMsg);
      throw new Error(errorMsg);
    } else if (!hello.authentication) {
      logger.log('No authentication required');
    }

    const identifyMessage: IdentifyMessage = {
      op: OpCode.Identify,
      d: {
        rpcVersion: hello.rpcVersion,
        eventSubscriptions: EventSubscription.All,
      }
    };

    if (authentication) {
      identifyMessage.d.authentication = authentication;
    }

    return new Promise<void>((resolve, reject) => {
      // Set up a one-time listener for the Identified message
      this.once('identified', () => {
        logger.log('Successfully identified with OBS WebSocket server');
        resolve();
      });

      // Set a timeout for identification
      const timeoutId = setTimeout(() => {
        const errorMsg = 'Identification timed out - OBS may be unresponsive or authentication failed';
        logger.error(errorMsg);
        reject(new Error(errorMsg));
      }, 5000);

      this.once('identified', () => clearTimeout(timeoutId));

      // Send the Identify message
      logger.log('Sending identify message...');
      this.ws!.send(JSON.stringify(identifyMessage));
    });
  }

  /**
   * Generate authentication string for OBS WebSocket
   */
  private generateAuthenticationString(password: string, salt: string, challenge: string): string {
    // Create SHA256 Base64 encoded secret
    const secretBytes = crypto.createHash('sha256')
      .update(password + salt)
      .digest();
    const secret = secretBytes.toString('base64');

    // Create authentication string
    const authBytes = crypto.createHash('sha256')
      .update(secret + challenge)
      .digest();
    const authentication = authBytes.toString('base64');

    return authentication;
  }
}

export default OBSWebSocketClient;
