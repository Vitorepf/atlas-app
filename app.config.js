const appJson = require('./app.json')

const expo = {
  ...appJson.expo,
  plugins: [
    ...(appJson.expo.plugins ?? []),
    'expo-background-task',
    'expo-notifications',
  ],
}

module.exports = { expo }
