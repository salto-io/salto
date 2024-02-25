# Stripe adapter

Stripe read-only adapter for salto.io

Salto helps you keep track of the main configuration entities in Stripe, including products, prices, coupons, report types, tax rates, webhook endpoints to track events, and country specifications.

We do this using the [Stripe REST API](https://stripe.com/docs/api).

**Note:** Some entities are not supported due to technical limitations, such as SKUs and shipping rates.

## Connecting to your Stripe account

Salto authenticates with Stripe using a Secret Key. To find yours, search for “Developers > API keys” in the search bar in Stripe’s dashboard, reveal the Secret Key and click to copy it.
When logging in with Salto, you will be asked to provide this Secret Key.
