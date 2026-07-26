import chalk, { type ColorName } from 'chalk';

export const HR = (
  color: ColorName = 'white',
  char: string = '-',
  length: number = 60
): string => {
  return chalk[color](char.repeat(length));
};
