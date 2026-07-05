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
        </s-app-nav>
    );
};

export default SideBarMenu;