import Stripe from 'stripe';
import db from '../config/database.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
    async createCustomer(email, name) {
        return await stripe.customers.create({
            email,
            name,
            metadata: {
                platform: 'aichmi'
            }
        });
    }

    async createSubscription(customerId, priceId) {
        return await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
        });
    }

    async updateOwnerSubscription(ownerId, stripeData) {
        const { customerId, subscriptionId, status } = stripeData;
        
        await db.execute(
            `UPDATE owners 
             SET stripe_customer_id = $1, stripe_subscription_id = $2, subscription_status = $3
             WHERE id = $4`,
            [customerId, subscriptionId, status, ownerId]
        );
    }

    async handleWebhook(signature, payload) {
        try {
            const event = stripe.webhooks.constructEvent(
                payload,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET
            );

            switch (event.type) {
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.updateSubscriptionStatus(event.data.object);
                    break;
                case 'customer.subscription.deleted':
                    await this.cancelSubscription(event.data.object);
                    break;
            }

            return { received: true };
        } catch (error) {
            throw new Error(`Webhook error: ${error.message}`);
        }
    }

    async updateSubscriptionStatus(subscription) {
        await db.execute(
            'UPDATE owners SET subscription_status = $1 WHERE stripe_subscription_id = $2',
            [subscription.status, subscription.id]
        );
    }

    async cancelSubscription(subscription) {
        await db.execute(
            'UPDATE owners SET subscription_status = $1 WHERE stripe_subscription_id = $2',
            ['canceled', subscription.id]
        );
    }

    async getSubscription(subscriptionId) {
        try {
            return await stripe.subscriptions.retrieve(subscriptionId);
        } catch (error) {
            throw new Error(`Failed to retrieve subscription: ${error.message}`);
        }
    }

    async createPaymentIntent(customerId, amount, currency = 'eur') {
        try {
            return await stripe.paymentIntents.create({
                customer: customerId,
                amount: amount * 100, // Convert to cents
                currency: currency,
                metadata: {
                    platform: 'aichmi'
                }
            });
        } catch (error) {
            throw new Error(`Failed to create payment intent: ${error.message}`);
        }
    }

    async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
        try {
            return await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    platform: 'aichmi'
                }
            });
        } catch (error) {
            throw new Error(`Failed to create checkout session: ${error.message}`);
        }
    }
}

export default new StripeService();