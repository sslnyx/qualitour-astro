
import { processHtmlContent } from './src/lib/wp-url';

const sampleHtml = `
<div style="background-image: url('http://qualitour.local/wp-content/uploads/2025/12/bg.jpg');"></div>
<div style="background: url(http://qualitour.local/wp-content/uploads/2025/12/bg2.jpg) no-repeat center;"></div>
`;

console.log("Original:");
console.log(sampleHtml);
console.log("\nProcessed:");
console.log(processHtmlContent(sampleHtml));
