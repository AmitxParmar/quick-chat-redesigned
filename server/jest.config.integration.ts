import config from './jest.config.ts';

const integrationConfig: typeof config = {
  ...config,
  testRegex: '(/__tests__/.*|(\\.|/)(integration\\.test))\\.(js?|ts?)?$',
};

export default integrationConfig;
