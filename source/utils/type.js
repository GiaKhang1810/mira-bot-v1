'use strict';

const ts = Object.prototype.toString;

const typeOf = value =>
    ts.call(value).slice(8, -1);

function type(value) {
    return typeOf(value);
}

type.get = typeOf;

type.isObject = value =>
    typeOf(value) === 'Object';

type.isArray = value =>
    typeOf(value) === 'Array';

type.isString = value =>
    typeOf(value) === 'String';

type.isNumber = value =>
    typeOf(value) === 'Number';

type.isBoolean = value =>
    typeOf(value) === 'Boolean';

type.isFunction = value =>
    typeOf(value) === 'Function';

type.isDate = value =>
    typeOf(value) === 'Date';

type.isRegExp = value =>
    typeOf(value) === 'RegExp';

type.isError = value =>
    typeOf(value) === 'Error';

type.isNull = value =>
    typeOf(value) === 'Null';

type.isUndefined = value =>
    typeOf(value) === 'Undefined';

type.isSymbol = value =>
    typeOf(value) === 'Symbol';

type.isClass = value =>
    type(value) === 'Function' && /^class\s/.test(Function.prototype.toString.call(value));

type.isMap = value =>
    typeOf(value) === 'Map';

type.isSet = value =>
    typeOf(value) === 'Set';

type.isURLSearchParams = value =>
    typeOf(value) === 'URLSearchParams';

type.isPrimitive = value =>
    isString(value) || isNumber(value) || isBoolean(value) ||
    isNull(value) || isUndefined(value) || isSymbol(value);

module.exports = type;