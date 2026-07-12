import { useNavigate } from "react-router-dom";

const SideBarMenu = () => {
    const navigate = useNavigate();

    return (
        <s-app-nav>
            <a
                href="/"
                onClick={(e) => {
                    e.preventDefault();
                    navigate(`/?shop=${shopDomain}&host=${app_host}`);
                }}
            >
                Dashboard
            </a>

            <a
                href="/plans"
                onClick={(e) => {
                    e.preventDefault();
                    navigate(`/plans?shop=${shopDomain}&host=${app_host}`);
                }}
            >
                Plans
            </a>

            <a
                href="/subscriptions"
                onClick={(e) => {
                    e.preventDefault();
                    navigate(`/subscriptions?shop=${shopDomain}&host=${app_host}`);
                }}
            >
                Subscriptions
            </a>

            <a
                href="/widgets"
                onClick={(e) => {
                    e.preventDefault();
                    navigate(`/widgets?shop=${shopDomain}&host=${app_host}`);
                }}
            >
                Widgets
            </a>
            <a
                href="/settings"
                onClick={(e) => {
                    e.preventDefault();
                    navigate(`/settings?shop=${shopDomain}&host=${app_host}`);
                }}
            >
                Settings
            </a>
        </s-app-nav>
    );
};

export default SideBarMenu;