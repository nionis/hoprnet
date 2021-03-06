// source: settings.proto
/**
 * @fileoverview
 * @enhanceable
 * @suppress {messageConventions} JS Compiler reports an error if a variable or
 *     field starts with 'MSG_' and isn't a translatable message.
 * @public
 */
// GENERATED CODE -- DO NOT EDIT!

var jspb = require('google-protobuf');
var goog = jspb;
var global = Function('return this')();

goog.exportSymbol('proto.ping.UpdateSettingsRequest', null, global);
goog.exportSymbol('proto.ping.UpdateSettingsResponse', null, global);
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.ping.UpdateSettingsRequest = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, proto.ping.UpdateSettingsRequest.repeatedFields_, null);
};
goog.inherits(proto.ping.UpdateSettingsRequest, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.ping.UpdateSettingsRequest.displayName = 'proto.ping.UpdateSettingsRequest';
}
/**
 * Generated by JsPbCodeGenerator.
 * @param {Array=} opt_data Optional initial data array, typically from a
 * server response, or constructed directly in Javascript. The array is used
 * in place and becomes part of the constructed object. It is not cloned.
 * If no data is provided, the constructed object will be empty, but still
 * valid.
 * @extends {jspb.Message}
 * @constructor
 */
proto.ping.UpdateSettingsResponse = function(opt_data) {
  jspb.Message.initialize(this, opt_data, 0, -1, null, null);
};
goog.inherits(proto.ping.UpdateSettingsResponse, jspb.Message);
if (goog.DEBUG && !COMPILED) {
  /**
   * @public
   * @override
   */
  proto.ping.UpdateSettingsResponse.displayName = 'proto.ping.UpdateSettingsResponse';
}

/**
 * List of repeated fields within this message type.
 * @private {!Array<number>}
 * @const
 */
proto.ping.UpdateSettingsRequest.repeatedFields_ = [2];



if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.ping.UpdateSettingsRequest.prototype.toObject = function(opt_includeInstance) {
  return proto.ping.UpdateSettingsRequest.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.ping.UpdateSettingsRequest} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.ping.UpdateSettingsRequest.toObject = function(includeInstance, msg) {
  var f, obj = {
    isUsingCoverTraffic: jspb.Message.getBooleanFieldWithDefault(msg, 1, false),
    bootstrapServersList: (f = jspb.Message.getRepeatedField(msg, 2)) == null ? undefined : f
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.ping.UpdateSettingsRequest}
 */
proto.ping.UpdateSettingsRequest.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.ping.UpdateSettingsRequest;
  return proto.ping.UpdateSettingsRequest.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.ping.UpdateSettingsRequest} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.ping.UpdateSettingsRequest}
 */
proto.ping.UpdateSettingsRequest.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {boolean} */ (reader.readBool());
      msg.setIsUsingCoverTraffic(value);
      break;
    case 2:
      var value = /** @type {string} */ (reader.readString());
      msg.addBootstrapServers(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.ping.UpdateSettingsRequest.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.ping.UpdateSettingsRequest.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.ping.UpdateSettingsRequest} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.ping.UpdateSettingsRequest.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getIsUsingCoverTraffic();
  if (f) {
    writer.writeBool(
      1,
      f
    );
  }
  f = message.getBootstrapServersList();
  if (f.length > 0) {
    writer.writeRepeatedString(
      2,
      f
    );
  }
};


/**
 * optional bool is_using_cover_traffic = 1;
 * @return {boolean}
 */
proto.ping.UpdateSettingsRequest.prototype.getIsUsingCoverTraffic = function() {
  return /** @type {boolean} */ (jspb.Message.getBooleanFieldWithDefault(this, 1, false));
};


/**
 * @param {boolean} value
 * @return {!proto.ping.UpdateSettingsRequest} returns this
 */
proto.ping.UpdateSettingsRequest.prototype.setIsUsingCoverTraffic = function(value) {
  return jspb.Message.setProto3BooleanField(this, 1, value);
};


/**
 * repeated string bootstrap_servers = 2;
 * @return {!Array<string>}
 */
proto.ping.UpdateSettingsRequest.prototype.getBootstrapServersList = function() {
  return /** @type {!Array<string>} */ (jspb.Message.getRepeatedField(this, 2));
};


/**
 * @param {!Array<string>} value
 * @return {!proto.ping.UpdateSettingsRequest} returns this
 */
proto.ping.UpdateSettingsRequest.prototype.setBootstrapServersList = function(value) {
  return jspb.Message.setField(this, 2, value || []);
};


/**
 * @param {string} value
 * @param {number=} opt_index
 * @return {!proto.ping.UpdateSettingsRequest} returns this
 */
proto.ping.UpdateSettingsRequest.prototype.addBootstrapServers = function(value, opt_index) {
  return jspb.Message.addToRepeatedField(this, 2, value, opt_index);
};


/**
 * Clears the list making it empty but non-null.
 * @return {!proto.ping.UpdateSettingsRequest} returns this
 */
proto.ping.UpdateSettingsRequest.prototype.clearBootstrapServersList = function() {
  return this.setBootstrapServersList([]);
};





if (jspb.Message.GENERATE_TO_OBJECT) {
/**
 * Creates an object representation of this proto.
 * Field names that are reserved in JavaScript and will be renamed to pb_name.
 * Optional fields that are not set will be set to undefined.
 * To access a reserved field use, foo.pb_<name>, eg, foo.pb_default.
 * For the list of reserved names please see:
 *     net/proto2/compiler/js/internal/generator.cc#kKeyword.
 * @param {boolean=} opt_includeInstance Deprecated. whether to include the
 *     JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @return {!Object}
 */
proto.ping.UpdateSettingsResponse.prototype.toObject = function(opt_includeInstance) {
  return proto.ping.UpdateSettingsResponse.toObject(opt_includeInstance, this);
};


/**
 * Static version of the {@see toObject} method.
 * @param {boolean|undefined} includeInstance Deprecated. Whether to include
 *     the JSPB instance for transitional soy proto support:
 *     http://goto/soy-param-migration
 * @param {!proto.ping.UpdateSettingsResponse} msg The msg instance to transform.
 * @return {!Object}
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.ping.UpdateSettingsResponse.toObject = function(includeInstance, msg) {
  var f, obj = {
    latency: jspb.Message.getFieldWithDefault(msg, 1, 0)
  };

  if (includeInstance) {
    obj.$jspbMessageInstance = msg;
  }
  return obj;
};
}


/**
 * Deserializes binary data (in protobuf wire format).
 * @param {jspb.ByteSource} bytes The bytes to deserialize.
 * @return {!proto.ping.UpdateSettingsResponse}
 */
proto.ping.UpdateSettingsResponse.deserializeBinary = function(bytes) {
  var reader = new jspb.BinaryReader(bytes);
  var msg = new proto.ping.UpdateSettingsResponse;
  return proto.ping.UpdateSettingsResponse.deserializeBinaryFromReader(msg, reader);
};


/**
 * Deserializes binary data (in protobuf wire format) from the
 * given reader into the given message object.
 * @param {!proto.ping.UpdateSettingsResponse} msg The message object to deserialize into.
 * @param {!jspb.BinaryReader} reader The BinaryReader to use.
 * @return {!proto.ping.UpdateSettingsResponse}
 */
proto.ping.UpdateSettingsResponse.deserializeBinaryFromReader = function(msg, reader) {
  while (reader.nextField()) {
    if (reader.isEndGroup()) {
      break;
    }
    var field = reader.getFieldNumber();
    switch (field) {
    case 1:
      var value = /** @type {number} */ (reader.readInt32());
      msg.setLatency(value);
      break;
    default:
      reader.skipField();
      break;
    }
  }
  return msg;
};


/**
 * Serializes the message to binary data (in protobuf wire format).
 * @return {!Uint8Array}
 */
proto.ping.UpdateSettingsResponse.prototype.serializeBinary = function() {
  var writer = new jspb.BinaryWriter();
  proto.ping.UpdateSettingsResponse.serializeBinaryToWriter(this, writer);
  return writer.getResultBuffer();
};


/**
 * Serializes the given message to binary data (in protobuf wire
 * format), writing to the given BinaryWriter.
 * @param {!proto.ping.UpdateSettingsResponse} message
 * @param {!jspb.BinaryWriter} writer
 * @suppress {unusedLocalVariables} f is only used for nested messages
 */
proto.ping.UpdateSettingsResponse.serializeBinaryToWriter = function(message, writer) {
  var f = undefined;
  f = message.getLatency();
  if (f !== 0) {
    writer.writeInt32(
      1,
      f
    );
  }
};


/**
 * optional int32 latency = 1;
 * @return {number}
 */
proto.ping.UpdateSettingsResponse.prototype.getLatency = function() {
  return /** @type {number} */ (jspb.Message.getFieldWithDefault(this, 1, 0));
};


/**
 * @param {number} value
 * @return {!proto.ping.UpdateSettingsResponse} returns this
 */
proto.ping.UpdateSettingsResponse.prototype.setLatency = function(value) {
  return jspb.Message.setProto3IntField(this, 1, value);
};


goog.object.extend(exports, proto.ping);
