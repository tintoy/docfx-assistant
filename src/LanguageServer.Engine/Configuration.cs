using Serilog.Events;

namespace DocFXAssistant.LanguageServer
{
    /// <summary>
    ///     The configuration for the language server.
    /// /// </summary>
    public sealed class Configuration
    {
        /// <summary>
        ///     Create a new <see cref="Configuration"/>.
        /// </summary>
        public Configuration()
        {

        }

        /// <summary>
        ///     The currently-configured minimum log level.
        /// </summary>
        public LogEventLevel LogLevel { get; set; } = LogEventLevel.Information;

        /// <summary>
        ///     Disable automatic warm-up of the NuGet API client?
        /// </summary>
        public bool DisableNuGetPreFetch { get; set; } = false;
    }
}
