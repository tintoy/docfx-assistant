using JsonRpc;
using Lsp;
using Lsp.Capabilities.Client;
using Lsp.Models;
using Lsp.Protocol;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
    
namespace DocFXAssistant.LanguageServer.Handlers
{
    using Documents;
    using Utilities;

    /// <summary>
    ///     Handler for completion requests.
    /// </summary>
    public sealed class CompletionHandler
        : Handler, ICompletionHandler
    {
        /// <summary>
        ///     Create a new <see cref="CompletionHandler"/>.
        /// </summary>
        /// <param name="server">
        ///     The language server.
        /// </param>
        /// <param name="workspace">
        ///     The document workspace.
        /// </param>
        /// <param name="logger">
        ///     The application logger.
        /// </param>
        public CompletionHandler(ILanguageServer server, Workspace workspace, ILogger logger)
            : base(server, logger)
        {
            if (workspace == null)
                throw new ArgumentNullException(nameof(workspace));

            Workspace = workspace;
        }

        /// <summary>
        ///     The document workspace.
        /// </summary>
        Workspace Workspace { get; }

        /// <summary>
        ///     The language server configuration.
        /// </summary>
        Configuration Configuration { get; }

        /// <summary>
        ///     The document selector that describes documents to synchronise.
        /// </summary>
        DocumentSelector DocumentSelector { get; } = new DocumentSelector(
            // TODO: Define document selectors.
        );

        /// <summary>
        ///     Get registration options for handling document events.
        /// </summary>
        TextDocumentRegistrationOptions DocumentRegistrationOptions
        {
            get => new TextDocumentRegistrationOptions
            {
                DocumentSelector = DocumentSelector
            };
        }

        /// <summary>
        ///     Get registration options for handling completion requests events.
        /// </summary>
        CompletionRegistrationOptions CompletionRegistrationOptions
        {
            get => new CompletionRegistrationOptions
            {
                DocumentSelector = DocumentSelector,
                ResolveProvider = false
            };
        }

        /// <summary>
        ///     The server's completion capabilities.
        /// </summary>
        CompletionCapability CompletionCapabilities { get; set; }

        /// <summary>
        ///     Called when completions are requested.
        /// </summary>
        /// <param name="parameters">
        ///     The request parameters.
        /// </param>
        /// <param name="cancellationToken">
        ///     A <see cref="CancellationToken"/> that can be used to cancel the request.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation whose result is the completion list or <c>null</c> if no completions are provided.
        /// </returns>
        Task<CompletionList> OnCompletion(TextDocumentPositionParams parameters, CancellationToken cancellationToken)
        {
            return Task.FromResult<CompletionList>(null);
        }

        /// <summary>
        ///     Handle a request for completion.
        /// </summary>
        /// <param name="parameters">
        ///     The request parameters.
        /// </param>
        /// <param name="cancellationToken">
        ///     A <see cref="CancellationToken"/> that can be used to cancel the request.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation whose result is the completion list or <c>null</c> if no completions are provided.
        /// </returns>
        async Task<CompletionList> IRequestHandler<TextDocumentPositionParams, CompletionList>.Handle(TextDocumentPositionParams parameters, CancellationToken cancellationToken)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));
            
            try
            {
                return await OnCompletion(parameters, cancellationToken);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnCompletion");

                return null;
            }
        }

        /// <summary>
        ///     Get registration options for handling completion requests.
        /// </summary>
        /// <returns>
        ///     The registration options.
        /// </returns>
        CompletionRegistrationOptions IRegistration<CompletionRegistrationOptions>.GetRegistrationOptions() => CompletionRegistrationOptions;

        /// <summary>
        ///     Called to inform the handler of the language server's completion capabilities.
        /// </summary>
        /// <param name="capabilities">
        ///     A <see cref="CompletionCapability"/> data structure representing the capabilities.
        /// </param>
        void ICapability<CompletionCapability>.SetCapability(CompletionCapability capabilities)
        {
            if (capabilities == null)
                throw new ArgumentNullException(nameof(capabilities));

            CompletionCapabilities = capabilities;
        }
    }
}
