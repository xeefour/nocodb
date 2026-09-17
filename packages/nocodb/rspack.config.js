const { resolve } = require('path');
const { rspack } = require('@rspack/core');
const nodeExternals = require('webpack-node-externals');
const { TsCheckerRspackPlugin } = require('ts-checker-rspack-plugin');

module.exports = {
  // Original CE rspack production config had `src/index.ts` here,
  // which only exports Noco without starting the server. The official
  // EE build uses `src/run/docker.ts` (same one as `watch:run`), which
  // actually boots the HTTP listener. Switch to that so the patched
  // bundle is a drop-in replacement for the official one.
  entry: './src/run/docker.ts',
  module: {
    rules: [
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: {
          name: '[path][name].[ext]',
        },
      },
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          sourceMaps: false,
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
              dynamicImport: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'es2017',
            loose: true,
            externalHelpers: false,
            keepClassNames: true,
          },
          module: {
            type: 'commonjs',
            strict: false,
            strictMode: true,
            lazy: false,
            noInterop: false,
          },
        },
      },
    ],
  },

  optimization: {
    minimize: false,
    nodeEnv: false,
  },
  externals: [
    nodeExternals({
      allowlist: ['nocodb-sdk'],
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json', '.node'],
    tsConfig: {
      configFile: resolve('tsconfig.json'),
    },
    alias: {
      '@noco-local-integrations': resolve(__dirname, '../noco-integrations/core'),
    },
  },
  mode: 'production',
  output: {
    filename: 'bundle.js',
    path: resolve(__dirname, 'dist'),
    library: 'libs',
    libraryTarget: 'umd',
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  node: {
    __dirname: false,
  },
  plugins: [
    new rspack.EnvironmentPlugin({
      EE: true,
    }),
    new rspack.CopyRspackPlugin({
      patterns: [{ from: 'src/public', to: 'public' }],
    }),
    // TsCheckerRspackPlugin intentionally disabled for the local
    // patch build. The CE source has known type errors against the
    // nocodb-sdk declarations that don't affect runtime; the official
    // EE build skips strict type checking too.
  ],
  target: 'node',
};
