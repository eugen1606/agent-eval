const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/backend'),
    clean: true,
    ...(!isProduction && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  watchOptions: {
    ignored: ['**/node_modules/**', '**/dist/**', '**/data/**'],
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: isProduction,
      sourceMap: !isProduction,
    }),
  ],
};
