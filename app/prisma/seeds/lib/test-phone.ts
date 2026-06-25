import { normalizePhone } from './normalize';
const samples = ['34981901906', '34981554391', '628182392', '683432412', '0034 915 551 234', '+34 91 555 1234', '915551234', '91 555 12 34', '351212345678', '212345678'];
for (const s of samples) console.log(s.padEnd(25), '→', normalizePhone(s));
