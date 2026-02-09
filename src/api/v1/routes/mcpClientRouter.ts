import express from 'express';
import multer from 'multer';
import { postMcpClient } from '../controllers/mcpClientController';
import { transcribeAudio } from '../../../middlewares';

const router = express.Router();

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

router.route('/').post(upload.single('audio'), transcribeAudio, postMcpClient);

export default router;
