#!/usr/bin/env python3

import unittest
import asyncio
from py_src.safety import validate_safety, SafetyViolationError, SafetyConfig
from py_src.client import OBSWebSocketClient, EventRingBuffer


class TestPythonSafety(unittest.TestCase):
    def test_read_only_blocks_mutations(self):
        cfg = SafetyConfig(read_only=True)
        # Get requests should succeed
        validate_safety("GetVersion", custom_config=cfg)
        validate_safety("GetCurrentProgramScene", custom_config=cfg)
        validate_safety("Sleep", custom_config=cfg)

        # Mutating requests should raise
        with self.assertRaises(SafetyViolationError):
            validate_safety("SetCurrentProgramScene", custom_config=cfg)
        with self.assertRaises(SafetyViolationError):
            validate_safety("StartStream", custom_config=cfg)

    def test_protect_destructive_requires_confirm(self):
        cfg = SafetyConfig(protect_destructive=True)
        # Without confirm, raises
        with self.assertRaises(SafetyViolationError):
            validate_safety("RemoveScene", is_confirmed=False, custom_config=cfg)
        with self.assertRaises(SafetyViolationError):
            validate_safety("StartStream", is_confirmed=False, custom_config=cfg)

        # With confirm, succeeds
        validate_safety("RemoveScene", is_confirmed=True, custom_config=cfg)
        validate_safety("StartStream", is_confirmed=True, custom_config=cfg)

    def test_allow_live_stream_bypass(self):
        cfg = SafetyConfig(protect_destructive=True, allow_live_stream=True)
        # Live streaming allowed without confirm
        validate_safety("StartStream", is_confirmed=False, custom_config=cfg)
        validate_safety("StopStream", is_confirmed=False, custom_config=cfg)
        # Non-streaming destructive still requires confirm
        with self.assertRaises(SafetyViolationError):
            validate_safety("RemoveScene", is_confirmed=False, custom_config=cfg)


class TestEventRingBuffer(unittest.TestCase):
    def test_ring_buffer_fifo_and_capacity(self):
        ring = EventRingBuffer(capacity=3)
        ring.push("Event1")
        ring.push("Event2")
        ring.push("Event3")
        self.assertEqual(len(ring), 3)

        # Overwrite Event1
        ring.push("Event4")
        self.assertEqual(len(ring), 3)
        events = ring.get_recent(limit=10)
        self.assertEqual([e["eventType"] for e in events], ["Event2", "Event3", "Event4"])

    def test_ring_buffer_filter(self):
        ring = EventRingBuffer(capacity=10)
        ring.push("StreamStateChanged")
        ring.push("CurrentProgramSceneChanged")
        ring.push("RecordStateChanged")

        scene_events = ring.get_recent(event_type="Scene")
        self.assertEqual(len(scene_events), 1)
        self.assertEqual(scene_events[0]["eventType"], "CurrentProgramSceneChanged")


class TestBatchRequestsSafety(unittest.TestCase):
    def setUp(self):
        self.loop = asyncio.new_event_loop()
        self.client = OBSWebSocketClient(loop=self.loop)

    def tearDown(self):
        self.loop.close()

    def test_batch_validates_safety_before_network(self):
        async def run_test():
            from py_src.safety import set_safety_config
            set_safety_config(SafetyConfig(read_only=True))
            try:
                await self.client.send_request_batch([
                    {"requestType": "GetVersion"},
                    {"requestType": "SetCurrentProgramScene", "requestData": {"sceneName": "Gaming"}}
                ])
                self.fail("Should have raised SafetyViolationError")
            except SafetyViolationError:
                pass
            finally:
                set_safety_config(None)

        self.loop.run_until_complete(run_test())


if __name__ == "__main__":
    unittest.main()
