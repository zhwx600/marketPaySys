/**
 * Created by Administrator on 2017/7/18.
 */
const pm = require('./../models/publicModel');
const ObjectID = require('mongodb').ObjectID;
const dbName = require('../public/getDbName').dbName;//获取门店信息
const mkOrder = new pm('mkOrder');
const url = require('url');
const qr = require('qr-image');
const file = require('./file.js');
const config = require('./../config/config.js');
const goodCar = new pm('mkGoodsCar');
const wxpay = require('./wxpay');
const alipay = require('./../alipay/index');

/*
* 分页获取订单
* @param = {
*  shopId:'超市id'
*  page_size:10,
*  page:1,
* }
* */
exports.getOrdersByPages = (req, res) => {
    const params = url.parse(req.url, true).query;
    //if (params.shopId) {
        // dbName(params.shopId, 'orders', (orders) => {
        //     if (orders) {
        //         const query = { userId: req.user.user._id };
        //         const sort = ['times', -1];
        //         const page_size = number(params.page_size);
        //         const page = number(params.page);

        //         orders.pagesSel(query, page_size, page, sort, (data) => {
        //             return res.send(data);
        //         })
        //     } else {
        //         return res.json({ code: 400, msg: '门店信息不存在' });
        //     }
        // })
        const query = { userId: req.user.user._id };
        const sort = ['times', -1];
        const page_size = Number(params.page_size);
        const page = Number(params.page);

        mkOrder.pagesSel(query, page_size, page, sort, (data) => {
            try {
            
                return res.send(data);

            } catch (error) {
                console.log(error);
            }
        })
    // } else {
    //     return res.json({ code: 400, msg: '缺少参数shopId' })
    // }
};

/*
* 通过id获取订单
* @param = {
*   payNo/oid:'',
*   shopId:'超市id'
* }
*
* */

exports.getOrderById = (req, res) => {
    let query = null;
    const params = url.parse(req.url, true).query;
    params.oid && (query = { oid: params.oid });
    params.payNo && (query = { payNo: params.payNo })
    mkOrder.find(query, (data) => {
        if (data.status > 0 && data.items.length > 0) {
            data.items[0].shopName = data.items[0].shopName || 'test';
            return res.json({ code: 200, data: data.items[0], msg: '查询完成' });
        } else if (data.status > 0 && data.items.length === 0) {
            return res.json({ code: 200, data: {}, msg: '无订单' });
        } else {
            return res.json({ code: 400, data: {}, msg: '网络错误' });
        }
    })
    // if(params.shopId&&params.id){
    //     dbName(params.shopId,'orders',(orders)=>{
    //         if(orders){
    //             var query = {id:params.id};
    //             orders.find(query,(data)=>{
    //                 if(data.status>0&&data.items.length>0){
    //                     return res.json({code:200,data:data.items[0],msg:'查询完成'});
    //                 }else if(data.status>0&&data.items.length===0){
    //                     return res.json({code:200,data:[],msg:'无订单'});
    //                 }else{
    //                     return res.json({code:400,data:[],msg:'网络错误'});
    //                 }
    //             })
    //         }else{
    //             return res.json({code:400,msg:'门店信息不存在'});
    //         }
    //     })

    // }else{
    //     return res.json({code:400,msg:'缺少参数shopId'})
    // }
};

/**
 * 下单
 * 校验库存/价格
 * 
 * */
exports.createOrder = (req, res) => {
    req.body.userId = req.user.user._id;
    req.body.orderStatus = 0;
    // req.body.payType = 'appAliPay';
    // req.body.payNo = new ObjectID().toSring();
    req.body.oid = new ObjectID().toString();
    req.body.shopName = 'test'; //店铺名称
    saveMKorders(req.body, res);
};

/**
 * 支付
 * 1.校验库存/价格
 * 2.支付
 * 3.删除购物车
 * @param = {
 *  payType:'支付方式'    // Zhifubao=1, Weixin=2,Yiwangtong=3,Yinlian=4,
 *  oid:'订单编号'
 *  shopId:''
 * }
 * 
 * 
 */

exports.orderPay = (req, res) => {
    // console.log(req.body);
    const query = { oid: req.body.oid };
    const payNo = new ObjectID().toString();
    const setModel = { "$set": { payType: req.body.payType, payNo: payNo} };
    mkOrder.find(query,data => {
        try {
            if (data.status>0&&data.items.length>0) {
                req.body.countAll = 0;
                data.items[0].goodsInfo.forEach(e=>{
                    req.body.countAll += Number(e.price)*Number(e.count);
                });
                req.body.body = `购买${data.items[0].goodsInfo[0].goodsName}等商品`;
                req.body.payNo = payNo;

                mkOrder.update(query, setModel, (data) => {
                })
                if(req.body.payType==2){//支付
                    wxpay.appOrders(req.body,req,res);
                }else if(req.body.payType==1){
                    alipay.appOrders(req.body,req,res);
                }else{
                    res.send({code:400,msg:'暂时不支持该支付类型'});
                }


            } else if (data.status>0&&data.items.length===0) {
                return res.json({ code: 400, msg: '订单不存在' });
            } else {
                 return res.json({ code: 400, msg: '网络错误' });
            }
        } catch (error) {
            console.log(error);
            return res.json({ code: 400, msg: '网络错误' });
        }
    })
}

//小程序微信支付
exports.wxAppletPay = (req,res) => {
    // console.log(req.body);
    const query = { oid: req.body.oid };
    const payNo = new ObjectID().toString();
    const setModel = { "$set": { payType: req.body.payType, payNo: payNo} };
    mkOrder.find(query,data => {
        try {
            if (data.status>0&&data.items.length>0) {
                req.body.countAll = 0;
                data.items[0].goodsInfo.forEach(e=>{
                    req.body.countAll += Number(e.price)*Number(e.count);
                });
                req.body.body = `购买${data.items[0].goodsInfo[0].goodsName}等商品`;
                req.body.payNo = payNo;

                mkOrder.update(query, setModel, (data) => {})
                wxpay.WxAppletPay(req.body,req,res);

            } else if (data.status>0&&data.items.length===0) {
                return res.json({ code: 400, msg: '订单不存在' });
            } else {
                 return res.json({ code: 400, msg: '网络错误' });
            }
        } catch (error) {
            console.log(error);
            return res.json({ code: 400, msg: '网络错误' });
        }
    })
}



const saveMKorders = (orderInfo, res) => {
    orderInfo.countAll = 0
    orderInfo.goodsInfo.forEach(e=>{
        orderInfo.countAll += Number(e.price)*Number(e.count);
    });
    mkOrder.save(orderInfo, (reData) => {
        try {
            return res.json({ code: 200, msg: "下单成功", data: { oid: orderInfo.oid } });
        } catch (error) {
            console.log(error);
            return res.json({ code: 400, msg: '网络错误', data: {} });
        }
    })
}

const delGoodsCar = (query) => {
    mkOrder.find(query, data => {
        try {
            if (data.status > 0 && data.items.length > 0) {
                let cidArr = [];
                data.items[0].goodsInfo.forEach(e => {
                    cidArr.push(e.cid);
                });
                const delQuery = { "goodsInfo.cid": { "$in": cidArr } };
                goodCar.delete(delQuery, (reData) => {
                    try {
                        console.log(reData);
                    } catch (error) {
                        console.log(error);
                    }
                })
            }
        } catch (error) {
            console.log(error);
        }
    })
}

/**
 * 校验库存
 * @param = {
 * 
 * }
 */

const checkStocks = () => {

}


/**
 * 订单二维码(小程序)（app客户端生成）
 * @param = {
 *    oid:'',
 *    shopId:'',
 * }
 */
exports.createOrderQRcode = (req, res) => {
    const url = `${req.body.shopId}_${req.body.oid}`;
    const fileBuffer = qr.imageSync(url, { type: 'png', size: 5 });
    file.uploadQRcode(req.body.shopId, fileBuffer, function (imageUrl) {
        return res.json({ code: 200, data: {"qrcodeUrl":imageUrl || '' }});
    })
}


/**
 * 取消/删除订单
 *  @param = {
 *    oid:'',
 *    shopId:'',
 * }
 */
exports.delOrder = (req, res) => {
    const query = { oid: req.body.oid };
    mkOrder.delete(query, data => {
        try {
            console.log(data);
            return res.json({ code: 200, msg: '取消/删除订单成功' });
        } catch (error) {
            console.log(error)
            return res.json({ code: 400, msg: '网络错误' });
        }
    })
}

/**
 *
 *
 * */
exports.paySuccess = (req, res) => {
    const query = { oid: req.body.oid };
    let setModel = { "$set": { orderStatus: 1 } };
    mkOrder.update(query, setModel, (data) => {
        //console.log(data);
        try {
            //删除购物车
            delGoodsCar(query);
            return res.json({ code: 200, msg: '支付成功' });
        } catch (error) {
            return res.json({ code: 400, msg: '网络错误' });
        }
    })
    // mkOrder.find(query,(result)=>{

    //     if (result.status > 0 && result.items.length > 0) {
    //         const url = `${result.items[0].shopId}_${req.body.oid}`;
    //         const fileBuffer = qr.imageSync(url, { type: 'png', size: 5 });
    //         file.uploadQRcode(req.body.shopId, fileBuffer, function (imageUrl) {
    //             setModel = { "$set": { orderStatus: 1,qrcodeUrl:imageUrl||'' } };
    //             mkOrder.update(query, setModel, (data) => {
    //                 //console.log(data);
    //                 try {
    //                     //删除购物车
    //                     delGoodsCar(query);
    //                     return res.json({ code: 200, msg: '支付成功' });
    //                 } catch (error) {
    //                     return res.json({ code: 400, msg: '网络错误' });
    //                 }
    //             })
    //         })
    //     }else{
    //         mkOrder.update(query, setModel, (data) => {
    //             //console.log(data);
    //             try {
    //                 //删除购物车
    //                 delGoodsCar(query);
    //                 return res.json({ code: 200, msg: '支付成功' });
    //             } catch (error) {
    //                 return res.json({ code: 400, msg: '网络错误' });
    //             }
    //         })
    //     }
    // })
    
}
