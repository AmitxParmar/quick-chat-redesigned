import { str, num } from 'envalid';
import appConfig from './app.config';
import { Environments } from '@/enums/environment.enum';

const envValidationConfig = {
  NODE_ENV: str({
    default: Environments.DEV,
    choices: [...Object.values(Environments)],
  }),
  PORT: num({ default: appConfig.defaultPort }),
  APP_BASE_URL: str(),
  DATABASE_URL: str(),
  CLIENT_URL: str({ default: 'http://localhost:3000' }),
  JWT_ACCESS_SECRET: str({ default: 'your-access-secret-key-change-in-production' }),
  JWT_REFRESH_SECRET: str({ default: 'your-refresh-secret-key-change-in-production' }),
  JWT_ACCESS_EXPIRY: str({ default: '1h' }),
  JWT_REFRESH_EXPIRY: str({ default: '7d' }),
  UPSTASH_REDIS_REST_URL: str({ desc: 'Upstash Redis REST URL' }),
  UPSTASH_REDIS_REST_TOKEN: str({ desc: 'Upstash Redis REST Token' }),
};

export default envValidationConfig;

