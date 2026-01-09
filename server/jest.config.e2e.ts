import config from './jest.config.ts';

const e2eConfig: typeof config = {
  ...config,
  testRegex: '(/__tests__/.*|(\\.|/)(e2e\\.test))\\.(js?|ts?)?$',
};

export default e2eConfig;
