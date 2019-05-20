
// elons@qq.com
import HttpRequestClass from './request'; //请求模块
import helper from './helper'; //工具类


const {
	objMap,
	objIsHasKey,
	objFindDepth,
	objSetDepthValue,
	objDeepMerge,
	objSetValueToClassPrivate,
	dataCheckType,
	dataTransform,
	strFormat,
	arrIsHasLen,
} = helper;


const SYSTEM_WEB = 'web';//网页
const SYSTEM_MINI_PROGRAM = 'miniProgram';//小程序

//默认配置
let config = {
	
	//系统环境
	system:SYSTEM_WEB,
	
	// 公共开关
	requestLoading: true, //是否请求前开启loading
	requestLoadingMsg: '加载中...',//loading文本
	
	// http请求
	httpServer: '', //接口地址
	httpTimeOut: 10000, //ajax请求超时时间
	httpSuccessCode:200,//http成功状态码
	httpStateField:'status',//http请求状态字段，axios是status，小程序是statusCode
	httpResponseType:'',//responseType数据类型
	httpMethod:'post',//默认http method发送方式
	httpHeader:{},//设置请求头
	
	// res数据
	resAutoHandleData:true,//自动数据预处理
	resAutoCheckState:true,//自动预检状态码
	resShowServerMsg:true,//获取到信息后，自动弹出服务器的消息文本
	resShowServerMsgCallback:(msg => {//自动弹出服务器信息的函数
		console.log("exe: get server msg：",msg)
	}),
	resStateSuccessCallback:(res =>{ //成功后数据处理
		console.log("exe: success callback");
	}),
	resStateErrorCallback:(res =>{ //状态码数据处理
		console.log("exe: error callback");
	}),
	resSuccessCode:0, //api成功状态码
	resStateSuccessField:'success',//会给结果补充一个成功字段
	resDataField: 'data', //表层数据字段名
	resDepthFieldUrl:'data.data',//深层数据对象路径字符串用"."分割，一般是在有分页或深层数据情况下使用
	resMsgField:'msg',//服务器消息字段
	resStateFields: ['state'], //状态字段字段数组，每1个都会判断是否正确，兼容多种接口
	resTransformField:'transform',//转换字段名称
	resTransformSuffixField: 'Format', //转换字段后缀
	resDictionaryValueField:'value',//对比字典中的字段
	resDictionaryConfigField:'dictionary',//字典字段名称
	resDictionarySuffixField: 'Dictionary', //转换字段后缀
	
	// token
	tokenAutoSend:true,//自动发送token
	tokenTestValue:'', //测试的token字符串
	tokenSendPostion: 'headers', //发送位置：'header、params'
	tokenSendField: 'token', //如果在头部，则设置请求名称

	// 分页
	pageAutoSend:false,//请求时自动发送分页参数
	pageIndex: 1, //请求页数
	pageSize: 10, //数量
	pageSizeField: 'pageSize',
	pageIndexField: 'pageNo',

	// http错误中文提示文本
	httpThrowText: {
		"400": '请求错误',
		"401": '未授权，请登录',
		"403": '拒绝访问',
		"404": '请求地址出错',
		"408": '请求超时',
		"500": '服务器内部错误',
		"501": '服务未实现',
		"502": '网关错误',
		"503": '服务不可用',
		"504": '网关超时',
		"505": 'HTTP版本不受支持',
		"1000": '登录状态已经失效，请从新登录。',
		"2000": '接口配置错误'
	},

	// 根据状态码返回错误中文文本
	getThrowText(code) {
		let text = '服务器请求错误';
		Object.keys(config.httpThrowText).map(key => {
			if (parseInt(key) === parseInt(code)) {
				text = config.httpThrowText[key]
			}
		})
		return text
	},
	
	
	// 判断res状态码是否正确
	cbCheckResState(res){
		return this.resStateFields.some(item => {
			return res[item] === this.resSuccessCode
		})
	},
	
	// 判断http状态码请求状态码是否正确
	cbIsHttpSuccess(code){
		return code == this.httpSuccessCode;
	}
}


//创建api，主要用于合并各种初始化配置
class CreateApiClass {
	constructor(apiConfig,publicConfig = {}) {
		this._api = {}; //最终生成的api，导出直接使用
		this._apiConfig = apiConfig; //接口配置，使用后删除
		this._publicConfig = Object.assign({},config,publicConfig)
		this.init();
		return this._api;
	}

	// 初始化
	init() {
		this.judgeEnvSetConfig();
		this.setApiName();
		this.removeDiscardConfig();
	}
	
	//根据环境设置配置
	judgeEnvSetConfig() {
		try{
			if(wx){
				this._publicConfig.system = SYSTEM_MINI_PROGRAM;
				this._publicConfig.httpStateField = 'statusCode';
			}
		}catch(e){
			//TODO handle the exception
		}
	}

	// 处理模块
	handleModule(callback) {
		objMap(this._apiConfig, res => callback(res))
	}

	// 拼接完整的请求地址
	mergeHttpUrl(module, api) {
		const moduleUrl = module.moduleUrl || '';
		const { query, url } = api;
		
		if (arrIsHasLen(query)) {
			api.url = strFormat(url, query)
		}
		return this._publicConfig.httpServer + moduleUrl + api.url;
	}

	// 设置api请求名
	setApiName() {
		objMap(this._apiConfig, res => {
			let { key, value } = res;
			this._api[key] = {};

			value.api.map(api => {
				api = this.mergeConfig(value, api)
				this._api[key][api.name] = this.createRequest(api)
			})
		})
	}

	// 合并接口url和公共配置
	mergeConfig(module, api) {
		api.url = this.mergeHttpUrl(module, api)
		return Object.assign({}, this._publicConfig, api)
	}

	// 移除不必要的配置
	removeDiscardConfig() {
		delete this._apiConfig;
	}

	// 创建请求函数
	createRequest(defaultConfig) {
		return newConfig => {
			this._api = objDeepMerge(defaultConfig,newConfig)
			return this.getRequestPromise()
		}
	}

	// 获取异步请求
	getRequestPromise() {
		return new HttpRequestClass(this._api).then(res => {
			return new ProcessResClass(res, this._api)
		})
	}
}


// 处理结果
class ProcessResClass {
	constructor(res, api) {
		this._api = api;
		this._res = res;
		this._data = undefined;//深层数据
		this._stateSuccess = false;
		this._queue = ['resCheckState','resShowMsg','resExecuteBeforeCallBack','resGetData','resSetTransform','resSetDictionary','resExecuteAfterCallBack'];
		
		this.init();
		return this._res;
	}
	
	//初始化
	init(){
		Object.keys(this._api).map(item => this[item] = this._api[item]);
		this._queue.map(item => this[item]())
	}

	//弹窗处理
	resShowMsg() {
		if (this.resShowServerMsg) {
			this.resShowServerMsgCallback(this._res[this.resMsgField])
		}
	}

	
	//字典转换规则处理
	resSetTransFunction(field,rule,transConfig,data){
		let transData = {};
		const transFunction = dataTransform[rule];
		if(transFunction && !(field in transData)) {
			transData[field] = this.resGetTransValue(data[field],transConfig[field][rule],transFunction)
		}
		return transData
	}
	
	// 字典获取转换后的值,如果结果是数组则遍历替换
	resGetTransValue(oldValue,setValue,transFunction){
		return Array.isArray(oldValue) 
			? oldValue.map(item => transFunction(item,setValue)) 
			: transFunction(oldValue, setValue);
	}
	
	// 字典转换
	resSetTransRule(data, transConfig) {
		let transData = {};
		Object.keys(transConfig).map(field => {
			Object.keys(transConfig[field]).map(rule => {
				transData = this.resSetTransFunction(field,rule,transConfig,data)
			})
		})
		return transData
	}
	
	//设置字典标志
	resGetTransData(dataObject){
		let transData = this.resSetTransRule(dataObject, this._api[this.resTransformField]);
		Object.keys(transData).map(key => {
			dataObject[key + this.resTransformSuffixField] = transData[key];
		})
		return dataObject;
	}
	
	//记录集获取深层数据
	resGetDepthInfo(depthField){
		return depthField ? objFindDepth(this._res, depthField) : undefined;
	}
	
	// 数据转换执行
	resDataTransform(){
		if (this._api[this.resTransformField]) {
			this.resBaseTypeExeCallback(data => this.resGetTransData(data))
		}
	}
	
	//检查返回数据状态
	resCheckState(){
		if (this.resAutoCheckState && this.cbCheckResState(this._res)) {
			this._stateSuccess = true;
		}
		if(this.resStateSuccessField){
			this._res[this.resStateSuccessField] = this._stateSuccess
		}
	}
	
	// 获取res内部数据
	resGetData(){
		if (this._stateSuccess) {
			this._data = this.resGetDepthInfo(this.resDepthFieldUrl);
		}
	}
	
	//转换预处理
	resSetTransform() {
		if (this._stateSuccess && this.resAutoHandleData) {
			this.resDataTransform()
		}
	}
	
	// 设置字典
	resSetDictionary(){
		if (this._stateSuccess && this._api[this.resDictionaryConfigField]) {
			this.resBaseTypeExeCallback(data => this.resGetDictionary(data))
		}
	}
	
	//结果根据数据类型执行回调
	resBaseTypeExeCallback(callback){
		let data = this._data;
		if(data){
			if (dataCheckType(data, 'Array')) {
				data.map(item => callback(item))
			}
			if (dataCheckType(data, 'Object')) {
				data = callback(data);
			}
			this._res = objSetDepthValue(this._res,this.resDepthFieldUrl,data) || this._res;
		}
	}
	
	//获取字典
	resGetDictionary(item){
		const dictionary = this._api[this.resDictionaryConfigField];
		Object.keys(item).map(key => {
			if(dictionary[key]){
				item[key + this.resDictionarySuffixField] = this.resGetDictionaryRes(dictionary,key,item)
			}
		})
		return item
	}
	
	// 获取字典结果
	resGetDictionaryRes(dictionary,key,item){
		const value = item[key],field = this._api.resDictionaryValueField;
		let dictionaryRes = dictionary[key].find(item => item[field] == value);
		
		if(!dictionaryRes[field]){
			dictionaryRes[field] = value
		}
		return dictionaryRes
	}


	
	// 执行前置回调
	resExecuteBeforeCallBack(){
		this._stateSuccess 
			? this.resStateSuccessCallback(this._res) 
			: this.resStateErrorCallback(this._res)
	}
	
	// 执行后置回调
	resExecuteAfterCallBack() {
		const callback = this.callback;
		if(callback){
			callback(this._res)
		}
	}
	
}




export default CreateApiClass
