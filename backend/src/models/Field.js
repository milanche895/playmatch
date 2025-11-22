const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sport: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    courtOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Court that owns this field
    price: { type: Number}, // Price per appointment for this field
    registrationDeadlineHours: { type: Number, default: 24 }, // Hours before match when registration closes
    workingHours: {
      monday: { start: String, end: String, closed: { type: Boolean, default: false } },
      tuesday: { start: String, end: String, closed: { type: Boolean, default: false } },
      wednesday: { start: String, end: String, closed: { type: Boolean, default: false } },
      thursday: { start: String, end: String, closed: { type: Boolean, default: false } },
      friday: { start: String, end: String, closed: { type: Boolean, default: false } },
      saturday: { start: String, end: String, closed: { type: Boolean, default: false } },
      sunday: { start: String, end: String, closed: { type: Boolean, default: false } }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Field', fieldSchema);


