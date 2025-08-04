import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';

export function getServiceStatusString(status: ServiceStatus) {
    if (status === ServiceStatus.Active) {
        return 'Active';
    }

    return 'In-Active';
}

export function getServiceStatusColor(status: ServiceStatus) {
    if (status === ServiceStatus.Active) {
        return 'text-primary-400-500';
    }

    return 'text-error-500';
}

// Finds an open order from the array that was placed on a specified service
export function openOrderOnService(
    service: ServiceEvent, orders: OrderEvent[]
): OrderEvent|undefined {
    return orders.find((order) =>
        order.status === OrderStatus.Open
        && order.referencedServiceAddress === service.serviceAddress
    )
}

// Finds an order in fulfillment from the array that was placed on a specified service
export function inFulfillmentOrderOnService(
    service: ServiceEvent, orders: OrderEvent[]
): OrderEvent|undefined {
    return orders.find((order) => {
        if (order.status === OrderStatus.Open) {
            for (const orderAddress of service.orders) {
                if (orderAddress === order.orderAddress) {
                    return order
                }
            }
        }

    })
}
