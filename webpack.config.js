const path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
  entry: './src/index.tsx',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
        include: /src/,
      },
      {
        test: /\.css$/,
        include: /src/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|gif)$/,
        include: /src/,
        use: [
          'file-loader'
        ]
      }
    ]
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    })
  ],
  devServer: {
    compress: true,
    historyApiFallback: true,
  }
};