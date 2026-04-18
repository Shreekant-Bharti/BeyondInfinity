'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    password: {
      type:     String,
      required: true,
    },
    regNumber: {
      type:     String,
      required: true,
    },
    branch: {
      type:     String,
      required: true,
    },
    batch: {
      type:     String,
      required: true,
    },
    idCardUrl: {
      type:     String,
      required: true,
    },
    role: {
      type:    String,
      enum:    ['ADMIN', 'WARDEN', 'STUDENT'],
      default: 'STUDENT',
    },
    status: {
      type:    String,
      enum:    ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    rejectionReason: {
      type:    String,
      default: '',
      trim:    true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  },
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plainText) {
  return bcrypt.compare(plainText, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const UserModel = mongoose.model('User', userSchema);

module.exports = UserModel;
