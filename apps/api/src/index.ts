// Entry point: load .env and start the HTTP server
try {
    process.loadEnvFile();
} catch {
    // no .env file: use existing environment variables
}

const { createApp } = await import('./app.js');

const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => {
    console.log(`API đang chạy ở cổng ${port}`);
});
