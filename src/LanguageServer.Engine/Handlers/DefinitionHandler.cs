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
    ///     Handler for symbol definition requests.
    /// </summary>
    public sealed class DefinitionHandler
        : Handler, IDefinitionHandler
    {
        /// <summary>
        ///     Create a new <see cref="DefinitionHandler"/>.
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
        public DefinitionHandler(ILanguageServer server, Workspace workspace, ILogger logger)
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
        ///     The server's symbol definition capabilities.
        /// </summary>
        DefinitionCapability DefinitionCapabilities { get; set; }

        /// <summary>
        ///     Called when a definition is requested.
        /// </summary>
        /// <param name="parameters">
        ///     The request parameters.
        /// </param>
        /// <param name="cancellationToken">
        ///     A <see cref="CancellationToken"/> that can be used to cancel the request.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation whose result is the definition location or <c>null</c> if no definition is provided.
        /// </returns>
        Task<LocationOrLocations> OnDefinition(TextDocumentPositionParams parameters, CancellationToken cancellationToken)
        {
            return Task.FromResult<LocationOrLocations>(null);
        }

        /// <summary>
        ///     Handle a request for a definition.
        /// </summary>
        /// <param name="parameters">
        ///     The request parameters.
        /// </param>
        /// <param name="cancellationToken">
        ///     A <see cref="CancellationToken"/> that can be used to cancel the request.
        /// </param>
        /// <returns>
        ///     A <see cref="Task"/> representing the operation whose result is definition location or <c>null</c> if no definition is provided.
        /// </returns>
        async Task<LocationOrLocations> IRequestHandler<TextDocumentPositionParams, LocationOrLocations>.Handle(TextDocumentPositionParams parameters, CancellationToken cancellationToken)
        {
            if (parameters == null)
                throw new ArgumentNullException(nameof(parameters));
            
            try
            {
                return await OnDefinition(parameters, cancellationToken);
            }
            catch (Exception unexpectedError)
            {
                Log.Error(unexpectedError, "Unhandled exception in {Method:l}.", "OnDefinition");

                return null;
            }
        }

        /// <summary>
        ///     Get registration options for handling document events.
        /// </summary>
        /// <returns>
        ///     The registration options.
        /// </returns>
        TextDocumentRegistrationOptions IRegistration<TextDocumentRegistrationOptions>.GetRegistrationOptions() => DocumentRegistrationOptions;

        /// <summary>
        ///     Called to inform the handler of the language server's symbol definition capabilities.
        /// </summary>
        /// <param name="capabilities">
        ///     A <see cref="DefinitionCapability"/> data structure representing the capabilities.
        /// </param>
        void ICapability<DefinitionCapability>.SetCapability(DefinitionCapability capabilities)
        {
            if (capabilities == null)
                throw new ArgumentNullException(nameof(capabilities));

            DefinitionCapabilities = capabilities;
        }
    }
}
