const stripe = require('stripe')(process.env.STRIPE_SECRET);
const axios = require('axios');
const utils = require('../utils/utils');
const manager = require('../services');
const new_utils = require('../utils/new_utils');
const models = require('../model/index');

const { TBLNAME } = process.env;
const CONNECT_PRI_KEY = 'STRIPECONNECT';
const CUSTOMER_PRI_KEY = 'STRIPECUSTOMER';
const SORT_KEY = 'METADATA';

async function createStripeConnect(req, res) {
    try {
        const userId = req.body.userid;
        const { code, clubId } = req.body;
        const clientId = process.env.STRIPE_CLIENT_ID;
        const secretKey = process.env.STRIPE_SECRET;
        const params = {
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: secretKey,
            code,
        };
        const url = 'https://connect.stripe.com/oauth/token';
        const result = await axios.post(url, params);
        const createRes = await new_utils.createData(
            CONNECT_PRI_KEY,
            userId,
            SORT_KEY,
            clubId,
            {
                ...result.data,
                table_name: CONNECT_PRI_KEY,
            },
            models.stripeConnect
        );
        if (createRes.data) {
            utils.sendResult(200, { status: true, data: result.data }, res);
        } else {
            utils.sendResult(400, { status: false, data: null }, res);
        }
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getStripeConnect(req, res) {
    const userId = req.body.userid;
    const { clubId } = req.params;
    const getRes = await new_utils.getData(
        CONNECT_PRI_KEY,
        userId,
        SORT_KEY,
        clubId
    );
    if (getRes.data) {
        utils.sendResult(201, { status: true, data: getRes.data }, res);
    } else {
        utils.sendResult(400, { status: false, data: getRes.error }, res);
    }
}

async function createCustomer(req, res) {
    try {
        const userId = req.body.userid;
        const getRes = await new_utils.getData(
            CUSTOMER_PRI_KEY,
            userId,
            SORT_KEY,
            userId
        );
        let customer;
        if (getRes.data) {
            customer = await stripe.customers.retrieve(getRes.data.customer_id);
            if (customer && !customer.deleted) {
                customer = await stripe.customers.update(customer.id, {
                    name: req.body.name,
                    email: req.body.email,
                    phone: req.body.phone,
                });
            } else {
                customer = await stripe.customers.create({
                    name: req.body.name,
                    email: req.body.email,
                    phone: req.body.phone,
                });
            }
            await new_utils.updateData(
                CUSTOMER_PRI_KEY,
                userId,
                SORT_KEY,
                userId,
                {
                    customer_id: customer.id,
                    customer_name: req.body.name,
                    customer_email: req.body.email,
                },
                models.customerConnect
            );
        } else {
            customer = await stripe.customers.create({
                name: req.body.name,
                email: req.body.email,
                phone: req.body.phone,
            });
            await new_utils.createData(
                CUSTOMER_PRI_KEY,
                userId,
                SORT_KEY,
                userId,
                {
                    customer_id: customer.id,
                    customer_name: req.body.name,
                    customer_email: req.body.email,
                    table_name: CUSTOMER_PRI_KEY,
                },
                models.customerConnect
            );
        }
        // Create a SetupIntent to set up our payment methods recurring usage
        const setupIntent = await stripe.setupIntents.create({
            payment_method_types: ['card'],
            customer: customer.id,
        });

        utils.sendResult(201, { status: true, customer, setupIntent }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, error }, res);
    }
}

async function subScribe(req, res) {
    try {
        const userId = req.body.userid;
        console.log('userId: ', userId);
        const getRes = await new_utils.getData(
            CUSTOMER_PRI_KEY,
            userId,
            SORT_KEY,
            userId
        );
        let subscription;
        await stripe.customers.update(req.body.customerId, {
            invoice_settings: {
                default_payment_method: req.body.paymentMethodId,
            },
        });
        if (getRes.data && getRes.data.subscription_id) {
            const retrive_subscription = await stripe.subscriptions.retrieve(
                getRes.data.subscription_id
            );
            if (
                retrive_subscription &&
                retrive_subscription.status !== 'canceled'
            ) {
                if (retrive_subscription.plan) {
                    if (
                        retrive_subscription.plan.price_id !== req.body.price_id
                    ) {
                        subscription = await stripe.subscriptions.create({
                            customer: req.body.customerId,
                            items: [{ price: req.body.price_id }],
                            expand: ['latest_invoice.payment_intent'],
                        });
                    } else {
                        subscription = retrive_subscription;
                    }
                }
            } else {
                subscription = await stripe.subscriptions.create({
                    customer: req.body.customerId,
                    items: [{ price: req.body.price_id }],
                    expand: ['latest_invoice.payment_intent'],
                });
            }
        } else {
            subscription = await stripe.subscriptions.create({
                customer: req.body.customerId,
                items: [{ price: req.body.price_id }],
                expand: ['latest_invoice.payment_intent'],
            });
        }
        await new_utils.updateData(
            CUSTOMER_PRI_KEY,
            userId,
            SORT_KEY,
            userId,
            {
                subscription_id: subscription.id,
            },
            models.customerConnect
        );
        utils.sendResult(201, { status: true, subscription }, res);
    } catch (error) {
        utils.sendResult(400, { status: false, error }, res);
    }
}

async function getStripeCustomer(req, res) {
    try {
        const { userId } = req.params;
        const getRes = await new_utils.getData(
            CUSTOMER_PRI_KEY,
            userId,
            SORT_KEY,
            userId
        );
        if (getRes.data) {
            if (getRes.data.subscription_id !== '') {
                console.log('getStripeCustomer: ', getRes.data);
                const retrive_subscription =
                    await stripe.subscriptions.retrieve(
                        getRes.data.subscription_id
                    );
                if (
                    retrive_subscription &&
                    retrive_subscription.status === 'active'
                ) {
                    utils.sendResult(
                        201,
                        { status: true, data: retrive_subscription },
                        res
                    );
                } else {
                    utils.sendResult(201, { status: true, data: null }, res);
                }
            } else {
                utils.sendResult(201, { status: true, data: null }, res);
            }
        } else {
            console.log('getStripeCustomer Error: ', getRes.error);
            if (getRes.error) {
                utils.sendResult(
                    400,
                    { status: false, data: getRes.error },
                    res
                );
            } else {
                utils.sendResult(201, { status: true, data: null }, res);
            }
        }
    } catch (error) {
        console.error('getStripeCustomer Error', error.message);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function subscribeWithCoupon(req, res) {
    const { userid } = req.body;
    const { coupon } = req.body;
    const price = req.body.price_id;
    const { customerId } = req.body;
    const retrieve_coupon = await stripe.coupons.retrieve(coupon);
    if (retrieve_coupon) {
        const getRes = await new_utils.getData(
            CUSTOMER_PRI_KEY,
            userid,
            SORT_KEY,
            userid
        );
        let subscription;
        if (getRes.data && getRes.data.subscription_id) {
            const retrive_subscription = await stripe.subscriptions.retrieve(
                getRes.data.subscription_id
            );
            if (
                retrive_subscription &&
                retrive_subscription.status !== 'canceled'
            ) {
                if (retrive_subscription.plan) {
                    if (
                        retrive_subscription.plan.price_id !== req.body.price_id
                    ) {
                        var d = new Date();
                        d.setDate(d.getDate() + 30);

                        // Zero the time component
                        d.setHours(0, 0, 0, 0);
                        const params = {
                            customer: customerId,
                            items: [{ price }],
                            coupon,
                            trial_end: Math.floor(d.getTime() / 1000),
                        };
                        console.log(d, Math.floor(d.getTime() / 1000));
                        subscription = await stripe.subscriptions.create(
                            params
                        );
                    } else {
                        subscription = retrive_subscription;
                    }
                }
            } else {
                let d = new Date();
                d.setDate(d.getDate() + 30);

                // Zero the time component
                d.setHours(0, 0, 0, 0);
                const params = {
                    customer: customerId,
                    items: [{ price }],
                    coupon,
                    trial_end: Math.floor(d.getTime() / 1000),
                };
                console.log(d, Math.floor(d.getTime() / 1000));
                subscription = await stripe.subscriptions.create(params);
            }
        } else {
            let d = new Date();
            d.setDate(d.getDate() + 30);

            // Zero the time component
            d.setHours(0, 0, 0, 0);
            const params = {
                customer: customerId,
                items: [{ price }],
                coupon,
                trial_end: Math.floor(d.getTime() / 1000),
            };
            console.log(d, Math.floor(d.getTime() / 1000));
            subscription = await stripe.subscriptions.create(params);
        }
        await new_utils.updateData(
            CUSTOMER_PRI_KEY,
            userid,
            SORT_KEY,
            userid,
            {
                subscription_id: subscription.id,
            },
            models.customerConnect
        );
        console.log('subscription: ', subscription);
        utils.sendResult(201, { status: true, data: subscription }, res);
    } else {
        utils.sendResult(400, { status: false, data: null }, res);
    }
}

async function subscribeItem(req, res) {
    try {
        const { userid } = req.body;
        const { price } = req.body;
        const getRes = await new_utils.getData(
            CUSTOMER_PRI_KEY,
            userid,
            SORT_KEY,
            userid
        );
        if (getRes.data) {
            if (
                getRes.data.subscription_id &&
                getRes.data.subscription_id !== ''
            ) {
                const listItems = await stripe.subscriptionItems.list({
                    subscription: getRes.data.subscription_id,
                });
                const filteredItems = listItems.data.filter(
                    (item) => item.price.id === price
                );
                let subscriptionItem;
                if (listItems && filteredItems && filteredItems.length === 1) {
                    const quantity = filteredItems[0].quantity + 1;
                    const subscriptionItemId = filteredItems[0].id;
                    subscriptionItem = await stripe.subscriptionItems.update(
                        subscriptionItemId,
                        {
                            quantity,
                        }
                    );
                } else {
                    subscriptionItem = await stripe.subscriptionItems.create({
                        subscription: getRes.data.subscription_id,
                        price,
                    });
                }

                console.log('subscriptionItem: ', subscriptionItem);
                utils.sendResult(
                    201,
                    { status: true, data: subscriptionItem },
                    res
                );
            } else {
                console.log('getRes.data null: ');
                utils.sendResult(201, { status: true, data: null }, res);
            }
        } else if (getRes.error) {
            console.error('getRes.error: ', getRes.error);
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        } else {
            console.error('getRes.error null: ');
            utils.sendResult(201, { status: true, data: null }, res);
        }
    } catch (error) {
        console.error('subscribeItem error: ', error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function cancelSubscribeItem(req, res) {
    const { userid } = req.params;
    const { price } = req.params;
    try {
        const getRes = await new_utils.getData(
            CUSTOMER_PRI_KEY,
            userid,
            SORT_KEY,
            userid
        );
        if (getRes.data && getRes.data.subscription_id) {
            const subscriptionItems = await stripe.subscriptionItems.list({
                subscription: getRes.data.subscription_id,
            });
            console.log('subscriptionItem: ', subscriptionItems.data, price);
            const item = subscriptionItems.data.find(
                (item) => item.price.id === price
            );
            console.log('item', item, item.id);
            if (item) {
                if (item.quantity > 1) {
                    const quantity = item.quantity - 1;
                    const updated = await stripe.subscriptionItems.update(
                        item.id,
                        { quantity }
                    );
                    console.log('updated', updated);
                    utils.sendResult(201, { status: true, data: updated }, res);
                } else {
                    const deleted = await stripe.subscriptionItems.del(item.id);
                    console.log('deleted', deleted);
                    utils.sendResult(201, { status: true, data: deleted }, res);
                }
            } else {
                utils.sendResult(201, { status: true, data: null }, res);
            }
        } else {
            utils.sendResult(400, { status: false, data: getRes.error }, res);
        }
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getPaymentMethods(req, res) {
    const { customer } = req.params;
    const { type } = req.params;
    try {
        const paymentMethods = await stripe.paymentMethods.list({
            customer,
            type,
        });
        console.log('paymentMethods', paymentMethods);
        if (paymentMethods) {
            utils.sendResult(201, { status: true, data: paymentMethods }, res);
        } else {
            utils.sendResult(201, { status: true, data: null }, res);
        }
    } catch (error) {
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

module.exports = {
    createStripeConnect,
    getStripeConnect,
    subScribe,
    createCustomer,
    getStripeCustomer,
    subscribeWithCoupon,
    subscribeItem,
    cancelSubscribeItem,
    getPaymentMethods,
};
