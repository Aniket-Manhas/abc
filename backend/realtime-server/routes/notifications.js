const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const sendEmail = require('../utils/mailer');

// POST /api/notifications — Admin broadcasts notification
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, message, type, targetRole, affectedNodes, expiresIn } = req.body;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 60000) : null;

    const notification = await Notification.create({
      title, message, type, targetRole: targetRole || 'all',
      sentBy: req.user._id, affectedNodes: affectedNodes || [],
      expiresAt
    });

    const io = req.app.get('io');
    if (io) {
      if (targetRole === 'admin') {
        io.to('admins').emit('notification:receive', notification);
      } else {
        io.emit('notification:receive', notification);
      }
    }

    // If it's a DANGER or emergency alert, also send an email to users
    if (type === 'danger' || type === 'emergency' || type === 'critical') {
      const targetQuery = targetRole && targetRole !== 'all' ? { role: targetRole } : {};
      const users = await User.find(targetQuery).select('email');
      
      const emailMessage = `
Alert from Sahyatri Station Management
--------------------------------------
TITLE: ${title}
MESSAGE: ${message}

Please exercise caution and follow instructions from station personnel.
      `;

      // Send emails (fire and forget to not block request)
      users.forEach(user => {
        if (user.email) {
          sendEmail({
            email: user.email,
            subject: `[Sahyatri Alert] ${title}`,
            message: emailMessage
          });
        }
      });
    }

    res.status(201).json(notification);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/notifications — Get active notifications
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    }).sort({ createdAt: -1 }).limit(20);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/notifications/:id/deactivate — Admin
router.put('/:id/deactivate', protect, adminOnly, async (req, res) => {
  try {
    const notif = await Notification.findByIdAndUpdate(
      req.params.id, { isActive: false }, { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
