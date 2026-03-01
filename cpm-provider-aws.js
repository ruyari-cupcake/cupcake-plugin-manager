//@name CPM Provider - AWS Bedrock
//@version 1.5.0
//@description AWS Bedrock (Claude) provider for Cupcake PM (Streaming)
//@icon 🔶
//@update-url https://raw.githubusercontent.com/ruyari-cupcake/cupcake-plugin-manager/main/cpm-provider-aws.js

(() => {
    const CPM = window.CupcakePM;
    if (!CPM) { console.error('[CPM-AWS] CupcakePM API not found!'); return; }
    const Risu = window.Risuai || window.risuai;

    /**
     * AWS-specific smart fetch: prefers risuFetch (full response collection) over
     * nativeFetch (streaming ReadableStream via IPC — can fail in some environments).
     *
     * Unlike the general smartNativeFetch in provider-manager, this does NOT sanitize
     * or reconstruct the body. AWS V4 signed requests depend on exact body bytes.
     * We pass the original body *object* to risuFetch so the host can JSON.stringify
     * it identically to what the signer hashed.
     *
     * @param {string|URL} signedUrl  - Signed URL from AwsV4Signer
     * @param {string}     signedMethod - HTTP method
     * @param {Headers|Object} signedHeaders - Signed headers
     * @param {string|null} signedBody - Stringified body (used for nativeFetch fallback)
     * @param {Object|undefined} bodyObj - Original body object (used for risuFetch)
     * @returns {Promise<Response>}
     */
    async function _awsSmartFetch(signedUrl, signedMethod, signedHeaders, signedBody, bodyObj) {
        const url = typeof signedUrl === 'string' ? signedUrl : signedUrl.toString();

        // Strategy 1: risuFetch — collects full response on host, returns non-streaming data.
        if (typeof Risu?.risuFetch === 'function') {
            try {
                // Convert Headers to plain object for postMessage serialization
                const hdrs = {};
                if (signedHeaders) {
                    if (typeof signedHeaders.forEach === 'function') {
                        signedHeaders.forEach((v, k) => { hdrs[k] = v; });
                    } else {
                        Object.assign(hdrs, signedHeaders);
                    }
                }

                const result = await Risu.risuFetch(url, {
                    method: signedMethod || 'GET',
                    headers: hdrs,
                    body: bodyObj,   // Original object (or undefined for GET)
                    rawResponse: true,
                    plainFetchForce: true,
                });

                if (result && result.data != null) {
                    let responseBody = null;
                    if (result.data instanceof Uint8Array) {
                        responseBody = result.data;
                    } else if (ArrayBuffer.isView(result.data) || result.data instanceof ArrayBuffer) {
                        responseBody = new Uint8Array(
                            result.data instanceof ArrayBuffer ? result.data : result.data.buffer
                        );
                    } else if (Array.isArray(result.data)) {
                        responseBody = new Uint8Array(result.data);
                    } else if (typeof result.data === 'string' && result.status && result.status !== 0) {
                        responseBody = new TextEncoder().encode(result.data);
                    }

                    if (responseBody) {
                        console.log(`[CPM-AWS] risuFetch OK: status=${result.status} ${url.substring(0, 60)}`);
                        return new Response(responseBody, {
                            status: result.status || 200,
                            headers: new Headers(result.headers || {})
                        });
                    }
                }
                console.log(`[CPM-AWS] risuFetch returned no usable data, falling back to nativeFetch`);
            } catch (e) {
                console.warn(`[CPM-AWS] risuFetch error: ${e.message}, falling back to nativeFetch`);
            }
        }

        // Strategy 2: nativeFetch (streaming) — last resort
        const nfOpts = { method: signedMethod, headers: signedHeaders };
        if (signedBody) nfOpts.body = signedBody;
        return await Risu.nativeFetch(url, nfOpts);
    }

    const AWS_MODELS = [
        { uniqueId: 'aws-us.anthropic.claude-opus-4-6-v1', id: 'us.anthropic.claude-opus-4-6-v1', name: 'Claude 4.6 Opus' },
        { uniqueId: 'aws-us.anthropic.claude-sonnet-4-6', id: 'us.anthropic.claude-sonnet-4-6', name: 'Claude 4.6 Sonnet' },
        { uniqueId: 'aws-us.anthropic.claude-4-5-opus-20251101-v1:0', id: 'us.anthropic.claude-4-5-opus-20251101-v1:0', name: 'Claude 4.5 Opus (20251101)' },
        { uniqueId: 'aws-us.anthropic.claude-4-5-sonnet-20250929-v1:0', id: 'us.anthropic.claude-4-5-sonnet-20250929-v1:0', name: 'Claude 4.5 Sonnet (20250929)' },
        { uniqueId: 'aws-us.anthropic.claude-4-5-haiku-20251001-v1:0', id: 'us.anthropic.claude-4-5-haiku-20251001-v1:0', name: 'Claude 4.5 Haiku (20251001)' },
        { uniqueId: 'aws-us.anthropic.claude-4-1-opus-20250805-v1:0', id: 'us.anthropic.claude-4-1-opus-20250805-v1:0', name: 'Claude 4.1 Opus (20250805)' },
        { uniqueId: 'aws-us.anthropic.claude-4-opus-20250514-v1:0', id: 'us.anthropic.claude-4-opus-20250514-v1:0', name: 'Claude 4 Opus (20250514)' },
        { uniqueId: 'aws-us.anthropic.claude-4-sonnet-20250514-v1:0', id: 'us.anthropic.claude-4-sonnet-20250514-v1:0', name: 'Claude 4 Sonnet (20250514)' },
    ];

    const ADAPTIVE_THINKING_MODEL_PATTERNS = ['claude-opus-4-6', 'claude-sonnet-4-6'];
    const EFFORT_OPTIONS = ['low', 'medium', 'high', 'max'];

    CPM.registerProvider({
        name: 'AWS',
        models: AWS_MODELS,
        fetchDynamicModels: async () => {
            try {
                const key = await CPM.safeGetArg('cpm_aws_key');
                const secret = await CPM.safeGetArg('cpm_aws_secret');
                const region = await CPM.safeGetArg('cpm_aws_region');
                if (!key || !secret || !region) return null;

                const AwsV4Signer = CPM.AwsV4Signer;
                const url = `https://bedrock.${region}.amazonaws.com/foundation-models`;
                const signer = new AwsV4Signer({
                    method: 'GET',
                    url: url,
                    accessKeyId: key,
                    secretAccessKey: secret,
                    service: 'bedrock',
                    region: region,
                });
                const signed = await signer.sign();
                const res = await _awsSmartFetch(signed.url, signed.method, signed.headers, null, undefined);
                if (!res.ok) return null;

                const data = await res.json();
                if (!data.modelSummaries) return null;

                // Filter to text-generation capable models (Claude, Llama, Mistral, etc.)
                const results = [];
                for (const m of data.modelSummaries) {
                    const id = m.modelId;
                    if (!id) continue;
                    // Only include models that support text output
                    const outputModes = m.outputModalities || [];
                    if (!outputModes.includes('TEXT')) continue;
                    // Only include invoke-capable models
                    const inferenceModes = m.inferenceTypesSupported || [];
                    if (!inferenceModes.includes('ON_DEMAND') && !inferenceModes.includes('INFERENCE_PROFILE')) continue;

                    let name = m.modelName || id;
                    // Add provider prefix for clarity
                    const provider = m.providerName || '';
                    if (provider && !name.toLowerCase().startsWith(provider.toLowerCase())) {
                        name = `${provider} ${name}`;
                    }

                    results.push({ uniqueId: `aws-${id}`, id: id, name: name });
                }

                // Also try cross-region inference profiles
                try {
                    const profileUrl = `https://bedrock.${region}.amazonaws.com/inference-profiles`;
                    const profileSigner = new AwsV4Signer({
                        method: 'GET',
                        url: profileUrl,
                        accessKeyId: key,
                        secretAccessKey: secret,
                        service: 'bedrock',
                        region: region,
                    });
                    const profileSigned = await profileSigner.sign();
                    const profileRes = await _awsSmartFetch(profileSigned.url, profileSigned.method, profileSigned.headers, null, undefined);
                    if (profileRes.ok) {
                        const profileData = await profileRes.json();
                        const profiles = profileData.inferenceProfileSummaries || [];
                        for (const p of profiles) {
                            const profileId = p.inferenceProfileId || p.inferenceProfileArn;
                            if (!profileId) continue;
                            // Skip if already have this model
                            if (results.some(r => r.id === profileId)) continue;
                            const name = p.inferenceProfileName || profileId;
                            // Only include Anthropic cross-region profiles for now
                            if (profileId.includes('anthropic') || profileId.includes('claude')) {
                                results.push({ uniqueId: `aws-${profileId}`, id: profileId, name: `${name} (Cross-Region)` });
                            }
                        }
                    }
                } catch (pe) {
                    console.warn('[CPM-AWS] Inference profiles listing not available:', pe.message);
                }

                return results.length > 0 ? results : null;
            } catch (e) {
                console.warn('[CPM-AWS] Dynamic model fetch error:', e);
                return null;
            }
        },
        fetcher: async function (modelDef, messages, temp, maxTokens, args, abortSignal) {
            // AWS Bedrock streaming uses application/vnd.amazon.eventstream binary protocol
            // which cannot be reliably parsed in the V3 plugin sandbox (text-based split/regex fails).
            // Force non-streaming (invoke endpoint) for all AWS models.
            const streamingEnabled = false;
            const config = {
                key: await CPM.safeGetArg('cpm_aws_key'),
                secret: await CPM.safeGetArg('cpm_aws_secret'),
                region: await CPM.safeGetArg('cpm_aws_region'),
                model: modelDef.id,
                budget: await CPM.safeGetArg('cpm_aws_thinking_budget'),
                effort: await CPM.safeGetArg('cpm_aws_thinking_effort'),
            };

            if (!config.key || !config.secret || !config.region || !config.model) {
                return { success: false, content: "[AWS Bedrock] Access Key, Secret, Region, and Model are required." };
            }

            const { messages: anthropicMessages, system: systemPrompt } = CPM.formatToAnthropic(messages);
            const body = {
                messages: anthropicMessages,
                max_tokens: maxTokens || 4096,
                temperature: temp !== undefined ? temp : 0.7,
                anthropic_version: "bedrock-2023-05-31"
            };
            if (args.top_p !== undefined && args.top_p !== null) body.top_p = args.top_p;
            if (args.top_k !== undefined && args.top_k !== null) body.top_k = args.top_k;
            if (systemPrompt) body.system = systemPrompt;

            // Thinking support
            const isAdaptiveModel = ADAPTIVE_THINKING_MODEL_PATTERNS.some(p => config.model.includes(p));
            if (isAdaptiveModel && (config.effort || parseInt(config.budget) > 0)) {
                // Claude 4.6 models: use adaptive thinking
                body.thinking = { type: 'adaptive' };
                const effort = config.effort && EFFORT_OPTIONS.includes(config.effort) ? config.effort : 'high';
                body.output_config = { effort };
                delete body.temperature;
            } else if (config.budget && parseInt(config.budget) > 0) {
                // Legacy models: use manual extended thinking
                body.thinking = { type: 'enabled', budget_tokens: parseInt(config.budget) };
                if (body.max_tokens <= body.thinking.budget_tokens) body.max_tokens = body.thinking.budget_tokens + 4096;
                delete body.temperature;
            }

            try {
                const AwsV4Signer = CPM.AwsV4Signer;

                if (!streamingEnabled) {
                    // ── Non-streaming: invoke endpoint → JSON response ──
                    const invokeUrl = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${config.model}/invoke`;
                    const signer = new AwsV4Signer({
                        method: 'POST',
                        url: invokeUrl,
                        accessKeyId: config.key,
                        secretAccessKey: config.secret,
                        service: 'bedrock',
                        region: config.region,
                        body: JSON.stringify(body),
                        headers: { 'Content-Type': 'application/json', 'accept': 'application/json' }
                    });
                    const signed = await signer.sign();
                    const res = await _awsSmartFetch(signed.url, signed.method, signed.headers, signed.body, body);
                    if (!res.ok) return { success: false, content: `[AWS Bedrock Error ${res.status}] ${await res.text()}` };
                    const data = await res.json();
                    // Bedrock invoke returns Anthropic Messages API format
                    let showThinking = false;
                    try { showThinking = await CPM.safeGetBoolArg('cpm_streaming_show_thinking', false); } catch { }
                    return typeof CPM.parseClaudeNonStreamingResponse === 'function'
                        ? CPM.parseClaudeNonStreamingResponse(data, { showThinking })
                        : { success: true, content: (Array.isArray(data.content) ? data.content.filter(b => b.type === 'text').map(b => b.text).join('') : '') };
                }

                // ── Streaming: invoke-with-response-stream endpoint ──
                const streamUrl = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${config.model}/invoke-with-response-stream`;
                const signer = new AwsV4Signer({
                    method: 'POST',
                    url: streamUrl,
                    accessKeyId: config.key,
                    secretAccessKey: config.secret,
                    service: 'bedrock',
                    region: config.region,
                    body: JSON.stringify(body),
                    headers: { 'Content-Type': 'application/json', 'accept': 'application/vnd.amazon.eventstream' }
                });

                const signed = await signer.sign();
                const res = await Risu.nativeFetch(signed.url.toString(), {
                    method: signed.method,
                    headers: signed.headers,
                    body: signed.body
                });

                if (!res.ok) return { success: false, content: `[AWS Bedrock Error ${res.status}] ${await res.text()}` };

                // AWS Bedrock invoke-with-response-stream returns event stream format.
                // Parse it to extract content_block_delta text chunks.
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                const stream = new ReadableStream({
                    async pull(controller) {
                        try {
                            while (true) {
                                if (abortSignal && abortSignal.aborted) {
                                    reader.cancel();
                                    controller.close();
                                    return;
                                }
                                const { done, value } = await reader.read();
                                if (done) { controller.close(); return; }
                                buffer += decoder.decode(value, { stream: true });
                                // AWS eventstream wraps JSON payloads; extract them
                                // The response contains base64-encoded JSON events or raw JSON chunks
                                const lines = buffer.split('\n');
                                buffer = lines.pop() || '';
                                for (const line of lines) {
                                    const trimmed = line.trim();
                                    if (!trimmed) continue;
                                    try {
                                        // Try to parse as JSON directly (Bedrock may send raw JSON events)
                                        const obj = JSON.parse(trimmed);
                                        if (obj.bytes) {
                                            // Base64 encoded event payload
                                            const decoded = JSON.parse(atob(obj.bytes));
                                            if (decoded.type === 'content_block_delta' && decoded.delta?.text) {
                                                controller.enqueue(decoded.delta.text);
                                            }
                                        } else if (obj.type === 'content_block_delta' && obj.delta?.text) {
                                            controller.enqueue(obj.delta.text);
                                        }
                                    } catch {
                                        // Try extracting JSON from binary event stream format
                                        // Look for content_block_delta patterns
                                        const deltaMatch = trimmed.match(/"type"\s*:\s*"content_block_delta"[^}]*"delta"\s*:\s*\{[^}]*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                                        if (deltaMatch) {
                                            try {
                                                controller.enqueue(JSON.parse('"' + deltaMatch[1] + '"'));
                                            } catch { }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            if (e.name !== 'AbortError') controller.error(e);
                            else controller.close();
                        }
                    },
                    cancel() { reader.cancel(); }
                });

                return { success: true, content: stream };
            } catch (e) {
                return { success: false, content: `[AWS Bedrock Exception] ${e.message}` };
            }
        },
        settingsTab: {
            id: 'tab-aws',
            icon: '🔶',
            label: 'AWS Bedrock',
            exportKeys: ['cpm_aws_key', 'cpm_aws_secret', 'cpm_aws_region', 'cpm_aws_thinking_budget', 'cpm_aws_thinking_effort', 'cpm_dynamic_aws'],
            renderContent: async (renderInput, lists) => {
                return `
                    <h3 class="text-3xl font-bold text-amber-400 mb-6 pb-3 border-b border-gray-700">AWS Bedrock Configuration (설정)</h3>
                    ${await renderInput('cpm_aws_key', 'Access Key ID (액세스 키)', 'password')}
                    ${await renderInput('cpm_aws_secret', 'Secret Access Key (시크릿 키)', 'password')}
                    ${await renderInput('cpm_aws_region', 'Region (리전 ex: us-east-1)')}
                    ${await renderInput('cpm_dynamic_aws', '📡 서버에서 모델 목록 불러오기 (Fetch models from API)', 'checkbox')}
                    ${await renderInput('cpm_aws_thinking_budget', 'Thinking Budget Tokens (4.5 이하 모델용, 0은 끄기)', 'number')}
                    ${await renderInput('cpm_aws_thinking_effort', 'Adaptive Thinking Effort (4.6 모델용: low/medium/high/max)')}
                `;
            }
        }
    });
})();
