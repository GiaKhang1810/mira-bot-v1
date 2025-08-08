'use strict';

const timezoneDefault = process.env.TIMEZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
const localeDefault = process.env.LOCALE ?? 'en-US';

function Clock(timestamp) {
    this.date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    this._timezone = timezoneDefault
    this._locale = localeDefault
}

Clock.prototype.tz = function (timezone) {
    this._timezone = timezone;
    return this;
}

Clock.prototype.locale = function (localeStr) {
    this._locale = localeStr;
    return this;
}

Clock.prototype.format = function (fString = 'YYYY-MM-DD HH:mm:ss') {
    return Clock._formatDate(this.date, fString, this._timezone, this._locale);
}

Clock.tz = function (timestamp, timezone = timezoneDefault, locale = localeDefault) {
    const clk = new Clock(timestamp);
    return clk.tz(timezone).locale(locale);
}

Clock.format = function (timestamp, formatStr = 'YYYY-MM-DD HH:mm:ss', timezone = timezoneDefault, locale = localeDefault) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return Clock._formatDate(date, formatStr, timezone, locale);
}

Clock.prototype.time = function (formatStr = 'HH:mm:ss DD/MM/YYYY') {
    return Clock._formatDate(this.date, formatStr, this._timezone, this._locale);
}

Clock.time = function (formatStr = 'HH:mm:ss DD/MM/YYYY') {
    return Clock._formatDate(new Date(), formatStr, timezoneDefault, localeDefault);
}

Clock._formatDate = function (date, formatStr, timezone, locale) {
    const formatter = new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        weekday: 'long'
    });

    const parts = formatter.formatToParts(date);
    return formatStr.replace(/HH|mm|ss|DD|MM|YYYY|ms|dddd/g, key => {
        switch (key) {
            case 'HH':
                return parts.find(part => part.type === 'hour')?.value ?? '00';
            case 'mm':
                return parts.find(part => part.type === 'minute')?.value ?? '00';
            case 'ss':
                return parts.find(part => part.type === 'second')?.value ?? '00';
            case 'ms':
                return String(date.getMilliseconds()).padStart(3, '0');
            case 'DD':
                return parts.find(part => part.type === 'day')?.value ?? '00';
            case 'MM':
                return parts.find(part => part.type === 'month')?.value ?? '00';
            case 'YYYY':
                return parts.find(part => part.type === 'year')?.value ?? '0000';
            case 'dddd':
                return parts.find(part => part.type === 'weekday')?.value ?? 'null';
            default:
                return key;
        }
    });
}

module.exports = Clock;
