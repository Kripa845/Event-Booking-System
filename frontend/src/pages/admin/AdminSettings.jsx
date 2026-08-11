function AdminSettings() {
    return (
        <>
            <div className="admin-page-header">
                <h1 className="admin-page-title">⚙️ Settings</h1>
                <p className="admin-page-subtitle">Platform configuration</p>
            </div>

            <div className="card" style={{ padding: "28px", maxWidth: "560px" }}>
                <div className="admin-section-title" style={{ marginBottom: "18px" }}>General</div>
                <div className="form-group">
                    <label className="form-label">Platform Name</label>
                    <input className="form-input" defaultValue="EventHub" />
                </div>
                <div className="form-group">
                    <label className="form-label">Currency</label>
                    <input className="form-input" defaultValue="NPR" />
                </div>
                <div className="divider" />
                <div className="alert alert-info">
                    More settings will appear here as the platform grows.
                </div>
            </div>
        </>
    );
}

export default AdminSettings;
