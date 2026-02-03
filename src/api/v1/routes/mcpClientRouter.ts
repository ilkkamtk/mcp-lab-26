import express from 'express';
import { postMcpClient } from '../controllers/mcpClientController';

const router = express.Router();

router.route('/').post(postMcpClient);

export default router;
