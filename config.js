var config = {
  cloudEnv: 'YOUR_CLOUD_ENV_ID',
  appid: 'YOUR_APP_ID',
  appName: 'SYwork',

  cloudFunctions: {
    userLogin: 'userLogin',
    backupRestore: 'backupRestore'
  },

  collections: {
    users: 'schedule_users',
    imageBackups: 'schedule_image_backups',
    dataBackups: 'schedule_data_backups'
  },

  backupSystemVersion: 'v2.0.0',

  defaults: {
    customWeeklyHours: 35,
    avatarType: 'emoji',
    avatarEmoji: '😊',
    chartType: 'line'
  },

  storageKeysForClear: [
    'shifts',
    'shiftTemplates',
    'statData',
    'statLastModified',
    'standardHours',
    'imagesLastModified',
    'customWeeklyHours',
    'customHours'
  ]
};

module.exports = config;
