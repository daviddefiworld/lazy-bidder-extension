const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    sidebar: './src/sidebar/index.tsx',
    content: './src/content/index.tsx',
    background: './src/background/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/sidebar/sidebar.html',
      filename: 'sidebar.html',
      chunks: ['sidebar']
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.' },
        { from: 'src/skills/indeed/pageHook.js', to: 'indeed/pageHook.js' },
        { from: 'src/skills/grok/pageHook.js', to: 'grok/pageHook.js' }
      ]
    })
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        // Bundle content script (and its deps) in one file — no shared chunks with sidebar
        content: {
          test: /[\\/]src[\\/]content[\\/]/,
          name: 'content',
          chunks: (chunk) => chunk.name === 'content',
          enforce: true
        },
        default: false,
        defaultVendors: false
      }
    }
  }
};
