import styles from "./RootHeader.module.css";

export function RootHeader() {
    return (
        <>
            <img
                className={styles.logo}
                alt="Portalbot Logo"
                src="/images/portal1_color_logo.png"
            />

            <div className={styles.titles}>
                <h1 className={styles.title}>Portalbot</h1>
                <p className={styles.subtitle}>
                    Telepresence powered by WebRTC. Join a space to get started!
                </p>
            </div>
        </>
    );
}
