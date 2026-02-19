require('dotenv').config();

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader' },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    // Inject env vars into the React bundle at build time
    new webpack.DefinePlugin({
      'process.env.UPLOAD_ADMIN_TOKEN':        JSON.stringify(process.env.UPLOAD_ADMIN_TOKEN || ''),
      'process.env.REACT_APP_PUSHER_KEY':      JSON.stringify(process.env.PUSHER_KEY || ''),
      'process.env.REACT_APP_PUSHER_CLUSTER':  JSON.stringify(process.env.PUSHER_CLUSTER || ''),
    }),
  ],
  devServer: {
    port: 3100,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api'],
        target: 'http://localhost:5000',
      },
    ],
  },
};
