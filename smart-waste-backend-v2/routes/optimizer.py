from ortools.constraint_solver import routing_enums_pb2, pywrapcp
import math


def calculate_distance(lat1, lng1, lat2, lng2):
    """Haversine formula for real GPS distance in meters."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def optimize_route(bins, depot_lat=28.6139, depot_lng=77.2090):
    """Solve TSP using Google OR-Tools to find the shortest collection route."""
    if not bins:
        return []

    # Add depot as starting point
    locations = [(depot_lat, depot_lng)] + [(b["lat"], b["lng"]) for b in bins]
    n = len(locations)

    # Build distance matrix
    distance_matrix = []
    for i in range(n):
        row = []
        for j in range(n):
            dist = calculate_distance(
                locations[i][0], locations[i][1],
                locations[j][0], locations[j][1]
            )
            row.append(int(dist))
        distance_matrix.append(row)

    # Setup OR-Tools TSP solver
    index_manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(index_manager)

    def distance_callback(from_index, to_index):
        from_node = index_manager.IndexToNode(from_index)
        to_node = index_manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.time_limit.seconds = 5

    solution = routing.SolveWithParameters(search_parameters)

    if not solution:
        return bins  # Return original order if no solution found

    # Extract optimized route
    optimized = []
    index = routing.Start(0)
    while not routing.IsEnd(index):
        node = index_manager.IndexToNode(index)
        if node > 0:  # Skip depot
            optimized.append(bins[node - 1])
        index = solution.Value(routing.NextVar(index))

    return optimized
