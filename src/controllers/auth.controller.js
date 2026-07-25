'use strict';

const Joi = require('joi');
const authService = require('../services/auth.service');
const validate = require('../middlewares/validator');

const loginSchema = Joi.object({
  pin: Joi.string().min(4).max(8).required(),
});

const authController = {
  /**
   * POST /api/auth/login
   * Body: { pin: string }
   * Returns: { token: string }
   */
  login: [
    validate(loginSchema),
    async (req, res, next) => {
      try {
        const { token } = authService.login(req.body.pin);
        return res.status(200).json({ token });
      } catch (err) {
        next(err);
      }
    },
  ],
};

module.exports = authController;
