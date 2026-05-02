'use strict';
const env = require('./utils/env');

interface Config {
  cloudEnv: string;
  appid: string;
  appName: string;
  cloudFunctions: {
    userLogin: string;
    backupRestore: string;
  };
  collections: {
    users: string;
    imageBackups: string;
    dataBackups: string;
  };
  backupSystemVersion: string;
  defaults: {
    customWeeklyHours: number;
    avatarType: string;
    avatarEmoji: string;
    chartType: string;
  };
  storageKeysForClear: string[];
}

const config: Config = {
  cloudEnv: env.CLOUD_ENV,
  appid: env.APP_ID,
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

export {};
