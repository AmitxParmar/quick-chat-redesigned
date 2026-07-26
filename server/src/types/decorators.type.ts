/**
 * The default argument type for decorators, represented as an array with a single unknown type.
 */
export type DefaultDecoratorArgs = [unknown];

/**
 * Function type definition for a descriptor. This function accepts arguments of type `TArgs`
 * and has a return type `TReturn` which defaults to `void`.
 */
export type DescriptorFn<TArgs, TReturn = void> = (args: TArgs) => TReturn;

/**
 * Represents a typed property descriptor for an object.
 */
export type Descriptor<
  TArgs extends DefaultDecoratorArgs = DefaultDecoratorArgs,
> = TypedPropertyDescriptor<DescriptorValue<TArgs>>;

/**
 * Represents a generated decorator.
 */
export type GeneratedDecorator<
  T = unknown,
  TArgs extends DefaultDecoratorArgs = DefaultDecoratorArgs,
> = (
  target: T,
  key: string,
  descriptor: Descriptor<TArgs>
) => Descriptor<TArgs>;

/**
 * Represents the value type for a descriptor.
 */
export type DescriptorValue<
  TArgs extends DefaultDecoratorArgs = DefaultDecoratorArgs,
> = (...args: DecoratorArgs<TArgs>) => unknown;

/**
 * Represents the arguments that a decorator accepts.
 */
export type DecoratorArgs<
  T extends DefaultDecoratorArgs = DefaultDecoratorArgs,
> = T extends never[] ? [string, number] : T;
