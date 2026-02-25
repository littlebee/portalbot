import { useCallback } from "react";
import ReactDOM from "react-dom/client";
import {
    Outlet,
    RouterProvider,
    createRootRoute,
    createRoute,
    createRouter,
    useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import "./styles/variables.css";
import "./styles.css";
import reportWebVitals from "./reportWebVitals.ts";

import App from "./App.tsx";

const rootRoute = createRootRoute({
    component: () => (
        <>
            <Outlet />
            <TanStackRouterDevtools />
        </>
    ),
});

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: IndexRouteComponent,
});

const spaceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/$spaceId",
    component: SpaceRouteComponent,
});

const routeTree = rootRoute.addChildren([indexRoute, spaceRoute]);

const router = createRouter({
    routeTree,
    context: {},
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultStructuralSharing: true,
    defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
    const root = ReactDOM.createRoot(rootElement);
    // Using <StrictMode> causes useWebRTC to run effects twice,
    // which leads to double WebSocket connections and other issues
    // when running locally via Vite dev server.
    root.render(<RouterProvider router={router} />);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

function IndexRouteComponent() {
    const navigate = useNavigate();
    const handleSelectSpace = useCallback(
        async (spaceId: string) => {
            await navigate({ to: "/$spaceId", params: { spaceId } });
        },
        [navigate],
    );

    return <App routeSpaceId={null} onSelectSpace={handleSelectSpace} />;
}

function SpaceRouteComponent() {
    const { spaceId } = spaceRoute.useParams();
    const navigate = useNavigate();
    const handleExitSpace = useCallback(() => {
        void navigate({ to: "/" });
    }, [navigate]);

    return <App routeSpaceId={spaceId} onExitSpace={handleExitSpace} />;
}
