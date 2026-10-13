var defaultIsMergeableObject = require('is-mergeable-object')

function emptyTarget(val) {
	return Array.isArray(val) ? [] : {}
}

function cloneUnlessOtherwiseSpecified(value, options) {
	// Custom merge functions may pass their own options to this public helper.
	return cloneValue(value, options, deepmerge)
}

function cloneValue(value, options, mergeFunction) {
	return (options.clone !== false && options.isMergeableObject(value))
		? (mergeFunction || merge)(emptyTarget(value), value, options)
		: value
}

function defaultArrayMerge(target, source, options) {
	return target.concat(source).map(function(element) {
		return cloneValue(element, options)
	})
}

function getMergeFunction(key, options) {
	if (!options.customMerge) {
		return merge
	}
	var customMerge = options.customMerge(key)
	return typeof customMerge === 'function' ? customMerge : merge
}

function getEnumerableOwnPropertySymbols(target) {
	return Object.getOwnPropertySymbols
		? Object.getOwnPropertySymbols(target).filter(function(symbol) {
			return Object.propertyIsEnumerable.call(target, symbol)
		})
		: []
}

function getKeys(target) {
	return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
}

function propertyIsOnObject(object, property) {
	try {
		return property in object
	} catch(_) {
		return false
	}
}

// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target, key) {
	return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
		&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
			&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
}

function mergeObject(target, source, options) {
	var destination = {}
	if (options.isMergeableObject(target)) {
		getKeys(target).forEach(function(key) {
			destination[key] = cloneValue(target[key], options)
		})
	}
	getKeys(source).forEach(function(key) {
		if (propertyIsUnsafe(target, key)) {
			return
		}

		if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
			destination[key] = getMergeFunction(key, options)(target[key], source[key], options)
		} else {
			destination[key] = cloneValue(source[key], options)
		}
	})
	return destination
}

function deepmerge(target, source, options) {
	if (!options) {
		return merge(target, source, {
			arrayMerge: defaultArrayMerge,
			isMergeableObject: defaultIsMergeableObject,
			cloneUnlessOtherwiseSpecified: cloneUnlessOtherwiseSpecified,
		})
	}
	// Inherit caller options so non-enumerable and inherited settings still work.
	options = Object.create(options)
	Object.defineProperties(options, {
		arrayMerge: {
			value: options.arrayMerge || defaultArrayMerge,
			writable: true, enumerable: true, configurable: true,
		},
		isMergeableObject: {
			value: options.isMergeableObject || defaultIsMergeableObject,
			writable: true, enumerable: true, configurable: true,
		},
		// Custom arrayMerge() implementations can use this helper, but the caller
		// may not replace it.
		cloneUnlessOtherwiseSpecified: {
			value: cloneUnlessOtherwiseSpecified,
			writable: true, enumerable: true, configurable: true,
		},
	})
	return merge(target, source, options)
}

function merge(target, source, options) {
	var sourceIsArray = Array.isArray(source)
	var targetIsArray = Array.isArray(target)
	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray

	if (!sourceAndTargetTypesMatch) {
		return cloneValue(source, options)
	} else if (sourceIsArray) {
		return options.arrayMerge(target, source, options)
	} else {
		return mergeObject(target, source, options)
	}
}

deepmerge.all = function deepmergeAll(array, options) {
	if (!Array.isArray(array)) {
		throw new Error('first argument should be an array')
	}

	return array.reduce(function(prev, next) {
		return deepmerge(prev, next, options)
	}, {})
}

module.exports = deepmerge
