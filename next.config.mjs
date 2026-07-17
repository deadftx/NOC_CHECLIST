/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite conexões do túnel do Cloudflare no modo de desenvolvimento
  allowedDevOrigins: [
    'appropriations-well-ended-personal.trycloudflare.com'
  ],
  // Ignora o empacotamento de bibliotecas nativas C++ para evitar o erro do sqlserver.node
  serverExternalPackages: ['mssql', 'msnodesqlv8']
};

export default nextConfig;
