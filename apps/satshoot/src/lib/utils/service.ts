import { ServiceStatus } from '$lib/events/ServiceEvent';

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
