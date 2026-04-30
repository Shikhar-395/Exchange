# Exchange

A full-stack crypto exchange built from scratch, with a matching engine, real-time order book, and a trading interface modeled after professional exchanges.

![Trading UI](https://www.notion.so/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2F085e8ad8-528e-47d7-8922-a23dc4016453%2Fe5525a0b-c22d-4577-9e29-e9eebb96bb6f%2FScreenshot_2024-06-22_at_9.37.01_AM.png?table=block&id=d7962dfb-d6fd-429b-ba9f-7b2f68fc6f4c&cache=v2)

The frontend supports limit and market orders, live depth view, candlestick charts via TradingView, and real-time trade feeds over WebSocket.

## Architecture

Orders flow from the browser through an API server into a Redis queue, where the matching engine picks them up, processes fills, and publishes results back over Redis pubsub. A database processor consumes trade events and writes them to a time series DB. WebSocket servers relay real-time updates back to connected clients.

![System Architecture](https://www.notion.so/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2F085e8ad8-528e-47d7-8922-a23dc4016453%2F9b4882ed-a882-4622-af17-737844b46632%2FScreenshot_2024-06-29_at_3.52.33_PM.png?table=block&id=1e051a7a-bdf4-42ab-a75e-169498633a4a&cache=v2)

Each market runs its own orderbook in the engine. When an order is placed, it gets routed to the correct orderbook, matched if possible, and the resulting `ORDER_FILLED` and `BOOK_UPDATED` events are pushed onto a queue for downstream consumers.

![Order Flow](https://www.notion.so/image/https%3A%2F%2Fprod-files-secure.s3.us-west-2.amazonaws.com%2F085e8ad8-528e-47d7-8922-a23dc4016453%2F4ea83063-e847-4989-8a85-8d3f04658023%2FScreenshot_2024-06-22_at_9.49.01_AM.png?table=block&id=7933da7d-aebe-4e96-8fc6-6563854514e5&cache=v2)
