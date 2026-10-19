import cors from 'cors';
import nocache from 'nocache';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import expressJSDocSwagger from 'express-jsdoc-swagger';
import home from './home';
import environment from './lib/environment';
import expressJSDocSwaggerConfig from './config/express-jsdoc-swagger.config';
import appConfig from './config/app.config';
import errorHandler from '@/middlewares/error-handler';
import routes from '@/modules/index';
import prismaClient from '@/lib/prisma';
import { isOriginAllowed } from '@/lib/cors-origins';
import { HttpForbiddenError } from '@/lib/errors';
import { apiLimiter } from '@/middlewares/rate-limiter';

class App {
  public express: express.Application;

  constructor() {
    this.express = express();
    this.express.set('trust proxy', 1);
    this.setMiddlewares();
    this.disableSettings();
    this.setRoutes();
    this.setErrorHandler();
    this.initializeDocs();
  }

  private setMiddlewares(): void {
    const { allowedOrigins } = environment;

    this.express.use(cors({
      origin: (origin, callback) => {
        // Requests without an Origin header are not browser cross-origin
        // requests (health checks, curl, server-to-server, probes). CORS is
        // enforced by browsers, so rejecting these only breaks legitimate
        // traffic — a browser can never strip its own Origin header.
        if (!origin) return callback(null, true);

        if (isOriginAllowed(origin, allowedOrigins)) {
          return callback(null, true);
        }

        // 403 rather than the error handler's default 500: a misconfigured
        // allow-list should be diagnosable, not look like a server crash.
        return callback(new HttpForbiddenError(`Origin not allowed: ${origin}`));
      },
      credentials: true,
    }));
    this.express.use(helmet());
    this.express.use(morgan('dev'));
    this.express.use(nocache());
    this.express.use(express.json({ limit: '100kb' }));
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(cookieParser());
    this.express.use(apiLimiter);
    this.express.use(express.static('public'));
  }

  private disableSettings(): void {
    this.express.disable('x-powered-by');
  }

  private setRoutes(): void {
    const {
      api: { version },
    } = appConfig;
    const { env } = environment;
    this.express.use('/', home);
    this.express.use(`/api/${version}/${env}`, routes);
  }

  private setErrorHandler(): void {
    this.express.use(errorHandler);
  }

  private initializeDocs(): void {
    if (!environment.isProd()) {
      expressJSDocSwagger(this.express)(expressJSDocSwaggerConfig);
    }
  }

  public async connectPrisma(): Promise<void> {
    await prismaClient.$connect();
  }
}

export default App;
