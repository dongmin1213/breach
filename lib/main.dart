import 'package:flutter/material.dart';
import 'app/app_state.dart';
import 'app/shell.dart';
import 'shared/ui/tokens.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final app = await AppState.boot();
  runApp(BreachApp(app: app));
}

class BreachApp extends StatelessWidget {
  final AppState app;
  const BreachApp({super.key, required this.app});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'BREACH',
    theme: T.theme(),
    debugShowCheckedModeBanner: false,
    home: AnimatedBuilder(
      animation: app,
      builder: (context, _) => Shell(app: app),
    ),
  );
}
