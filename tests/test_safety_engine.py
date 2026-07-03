#!/usr/bin/env python3
"""
Unit Tests for ChargeWise Edge Safety Engine
-------------------------------------------
Verifies AIS 156 Phase 2 compliance of the battery safety engine.
"""

import sys
import os
import unittest
from datetime import datetime, timedelta

# Adjust path to import from scripts directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))

from edge_simulator import SafetyEngine

class TestSafetyEngine(unittest.TestCase):
    
    def setUp(self):
        self.engine = SafetyEngine()
        self.now = datetime.now()

    def test_normal_temperature_state(self):
        """Verifies that normal temperatures do not trigger alarms and allow full C-rate."""
        alarm, msg, c_rate = self.engine.evaluate(32.0, self.now)
        self.assertFalse(alarm)
        self.assertEqual(c_rate, 1.0)
        self.assertIn("normal", msg.lower())

    def test_warning_temperature_state(self):
        """Verifies that temperatures above 42°C trigger a warning and throttle the C-rate."""
        alarm, msg, c_rate = self.engine.evaluate(43.5, self.now)
        self.assertFalse(alarm)
        self.assertEqual(c_rate, 0.6)
        self.assertIn("warning", msg.lower())

    def test_critical_temperature_state(self):
        """Verifies that temperatures above 45°C trigger a critical alarm and deep throttling."""
        alarm, msg, c_rate = self.engine.evaluate(47.2, self.now)
        self.assertTrue(alarm)
        self.assertEqual(c_rate, 0.1)
        self.assertIn("critical", msg.lower())

    def test_temperature_gradient_alarm(self):
        """Verifies that rapid temperature rise (>2°C/min) triggers a gradient alarm."""
        # Initial reading
        t0 = self.now - timedelta(seconds=60)
        self.engine.evaluate(30.0, t0)
        
        # Intermediate reading 30 seconds later
        t1 = self.now - timedelta(seconds=30)
        self.engine.evaluate(31.2, t1)
        
        # Current reading (total rise of 2.5°C in 60s -> 2.5°C/min)
        alarm, msg, c_rate = self.engine.evaluate(32.5, self.now)
        
        self.assertTrue(alarm)
        self.assertEqual(c_rate, 0.2)
        self.assertIn("rise rate too high", msg.lower())

    def test_gradient_threshold_boundary(self):
        """Verifies that slow temperature rise (1.5°C/min) does not trigger rise rate alarm."""
        t0 = self.now - timedelta(seconds=60)
        self.engine.evaluate(30.0, t0)
        
        alarm, msg, c_rate = self.engine.evaluate(31.5, self.now)
        self.assertFalse(alarm)
        self.assertEqual(c_rate, 1.0)
        self.assertNotIn("rise rate too high", msg.lower())

if __name__ == '__main__':
    unittest.main()
