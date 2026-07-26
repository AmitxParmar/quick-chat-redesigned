import {
  type DefaultDecoratorArgs,
  type DescriptorFn,
  type GeneratedDecorator,
} from '@/types/decorators.type';
import logger from '@/lib/logger';

/**
 * Creates a decorator that wraps the original method with an additional function.
 * @param descriptorFn - The additional function to execute before the original method.
 * @param descriptorArgs - Arguments for the descriptor function.
 * @returns The generated decorator function.
 */
export function createDecorator<
  TFnArgs,
  TArgs extends DefaultDecoratorArgs = DefaultDecoratorArgs,
  TReturn = void,
>(
  descriptorFn: DescriptorFn<TFnArgs, TReturn>,
  descriptorArgs: TFnArgs
): GeneratedDecorator<unknown, TArgs> {
  return function (_target, key, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
      logger.info(`Executing decorator before method: ${key}`);
      descriptorFn(descriptorArgs);
      logger.info('Decorator executed');
      return originalMethod ? originalMethod.apply(this, args) : null;
    };
    return descriptor;
  };
}
