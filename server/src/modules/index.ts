import { Router } from 'express';

import auth from './auth/auth.route';
import message from './message/message.route';
import conversation from './conversation/conversation.route';
import contact from './contact/contact.route';
import user from './user/user.route';

const router: Router = Router();

router.use('/auth', auth);
router.use('/messages', message);
router.use('/conversations', conversation);
router.use('/contacts', contact);
router.use('/users', user);
// router.use("/projects", projects);

export default router;


